// Shapes usage.json (written by scripts/export-usage.mjs) into what the sections draw.
// Token tuples are always [input, output, cacheWrite, cacheRead, thinking, requests].
import { setFamilies } from './format.js';

export const IN = 0, OUT = 1, CW = 2, CR = 3, THINK = 4, REQ = 5;

/** cloud = Claude Code (the default), local = Ollama on the same Mac (usage.json `local`), all = both added. */
export const VIEWS = ['cloud', 'local', 'all'];

/** Fixed order = fixed colour. The order was validated for colour-blind separation; don't reshuffle. */
export const FAMILIES = ['Opus', 'Sonnet', 'Fable', 'Haiku'];

export function familyOf(model) {
  const hit = FAMILIES.find((f) => model.toLowerCase().includes(f.toLowerCase()));
  return hit ?? 'Other';
}

export const isLocal = (model) => !model.startsWith('claude-');

/** qwen3.5:9b -> Qwen, qwen3-coder:30b -> Qwen, gpt-oss:20b -> GPT-OSS, llama3.2 -> Llama */
const SPELLING = { gpt: 'GPT', 'gpt-oss': 'GPT-OSS' };
export function localFamily(model) {
  const base = model.split(':')[0].replace(/[\d.].*$/, '').replace(/-$/, '') || model;
  return SPELLING[base] ?? base[0].toUpperCase() + base.slice(1);
}

/** claude-opus-5-5 -> Opus 5.5, claude-haiku-4-5 -> Haiku 4.5, claude-opus-5 -> Opus 5; qwen3.5:9b -> qwen3.5 9b */
export function modelName(model) {
  if (isLocal(model)) return model.replace(':', ' ');
  const m = model.replace(/^claude-/, '').match(/^([a-z]+)-(\d+)(?:-(\d+))?/);
  if (!m) return model;
  const name = m[1][0].toUpperCase() + m[1].slice(1);
  return `${name} ${m[2]}${m[3] ? `.${m[3]}` : ''}`;
}

const sum = (t) => t[IN] + t[OUT] + t[CW] + t[CR];

const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const utc = (d) => Date.parse(`${d}T00:00:00Z`);

/** Cloud and local added together: models never share an id (Claude's all start with claude-). */
function combine(a, b) {
  const byDate = new Map(a.days.map((x) => [x.d, { d: x.d, m: { ...x.m } }]));
  for (const x of b.days) {
    const day = byDate.get(x.d) ?? { d: x.d, m: {} };
    Object.assign(day.m, x.m);
    byDate.set(x.d, day);
  }
  const days = [...byDate.values()].sort((x, y) => x.d.localeCompare(y.d));
  return {
    range: { from: days[0].d, to: days.at(-1).d },
    totals: a.totals.map((v, i) => v + b.totals[i]),
    models: { ...a.models, ...b.models },
    days,
    hours: a.hours.map((v, i) => v + b.hours[i]),
    hoursByModel: { ...a.hoursByModel, ...b.hoursByModel },
  };
}

/**
 * What a view draws from, how its models group into families, and which colour slot each family takes.
 * Cloud keeps Opus → Haiku on slots 1-4 even when one is missing; local ranks its families by output and takes
 * the first four slots in the same validated order; all is two series, Claude and Local.
 */
function scheme(raw, view) {
  const local = raw.local?.range ? raw.local : null;
  if (view === 'local' && local) {
    const out = {};
    for (const [m, t] of Object.entries(local.models)) out[localFamily(m)] = (out[localFamily(m)] ?? 0) + t[OUT];
    const families = Object.keys(out).sort((a, b) => out[b] - out[a]).slice(0, 4);
    const of = (m) => (families.includes(localFamily(m)) ? localFamily(m) : 'Other');
    return { src: local, families, palette: families, familyOf: of };
  }
  if (view === 'all' && local) {
    const families = ['Claude', 'Local'];
    return { src: combine(raw, local), families, palette: families, familyOf: (m) => (isLocal(m) ? 'Local' : 'Claude') };
  }
  const families = FAMILIES.filter((f) => Object.keys(raw.models).some((m) => familyOf(m) === f));
  return { src: raw, families, palette: FAMILIES, familyOf };
}

export function derive(base, view = 'cloud') {
  const { src, families, palette, familyOf } = scheme(base, view);
  setFamilies(palette);
  const raw = { ...src, generatedAt: base.generatedAt, tz: base.tz };

  const models = Object.entries(raw.models)
    .map(([id, t]) => ({ id, name: modelName(id), family: familyOf(id), t }))
    .sort((a, b) => b.t[OUT] - a.t[OUT]);

  const byDate = new Map(raw.days.map((d) => [d.d, d]));
  // Every calendar day from first activity to the export date, idle days included.
  const days = [];
  if (raw.range) {
    // Run through the export date so quiet days since the last session still show as empty.
    const exported = new Intl.DateTimeFormat('en-CA', { timeZone: raw.tz }).format(new Date(raw.generatedAt));
    const last = Math.max(utc(raw.range.to), utc(exported));
    for (let ms = utc(raw.range.from); ms <= last; ms += DAY) {
      const d = iso(ms);
      const src = byDate.get(d);
      const fam = Object.fromEntries(families.map((f) => [f, 0]));
      let out = 0, total = 0, req = 0;
      for (const [model, t] of Object.entries(src?.m ?? {})) {
        const f = familyOf(model);
        if (f in fam) fam[f] += t[OUT];
        out += t[OUT];
        total += sum(t);
        req += t[REQ];
      }
      days.push({ d, out, total, req, fam, dow: (new Date(ms).getUTCDay() + 6) % 7 });
    }
  }

  const t = raw.totals;
  return {
    raw,
    families,
    models,
    days,
    window: recentWindow(days, families),
    hours: raw.hours,
    hoursByFamily: hoursByFamilyOf(raw, families, familyOf),
    limits: base.limits,
    view,
    totals: { all: sum(t), input: t[IN], output: t[OUT], cacheWrite: t[CW], cacheRead: t[CR], thinking: t[THINK], requests: t[REQ] },
    activeDays: raw.days.length,
    busiest: days.reduce((a, b) => (b.out > (a?.out ?? -1) ? b : a), null),
  };
}

/** Days -> Monday-start weeks, for charts too narrow to show one column per day. */
export function toWeeks(days, families) {
  const weeks = [];
  for (const day of days) {
    if (day.dow === 0 || !weeks.length) weeks.push({ d: day.d, end: day.d, out: 0, req: 0, fam: Object.fromEntries(families.map((f) => [f, 0])) });
    const w = weeks.at(-1);
    w.end = day.d;
    w.out += day.out;
    w.req += day.req;
    for (const f of families) w.fam[f] += day.fam[f];
  }
  return weeks;
}

/**
 * About three months: the current week (Monday to the export date) and the 12 full weeks before it. Days before
 * tracking began are padded in with `pre: true` so the calendar and the model chart always show a steady window.
 */
export const WINDOW_WEEKS = 13;
export function recentWindow(days, families) {
  if (!days.length) return [];
  const last = days.at(-1);
  const start = utc(last.d) - (last.dow + (WINDOW_WEEKS - 1) * 7) * DAY;
  const byDate = new Map(days.map((x) => [x.d, x]));
  const out = [];
  for (let ms = start; ms <= utc(last.d); ms += DAY) {
    const d = iso(ms);
    out.push(byDate.get(d) ?? { d, out: 0, total: 0, req: 0, fam: Object.fromEntries(families.map((f) => [f, 0])), dow: (new Date(ms).getUTCDay() + 6) % 7, pre: true });
  }
  return out;
}

/** raw.hoursByModel (optional) summed into families, per hour. Hours that can't be split land in `Other`. */
function hoursByFamilyOf(raw, families, familyOf) {
  if (!raw.hoursByModel) return null;
  const out = Array.from({ length: 24 }, () => Object.fromEntries(families.map((f) => [f, 0])));
  for (const [model, counts] of Object.entries(raw.hoursByModel)) {
    const f = familyOf(model);
    if (f in out[0]) counts.forEach((v, h) => (out[h][f] += v));
  }
  // Days exported before per-model hours existed only have totals; keep the bars honest with an unsplit remainder.
  const rest = out.map((o, h) => Math.max(0, (raw.hours[h] ?? 0) - families.reduce((s, f) => s + o[f], 0)));
  if (rest.some(Boolean)) out.forEach((o, h) => (o.Other = rest[h]));
  return out;
}

/** A column segment: 4px rounded data-end on the top segment only, square everywhere else. */
export function column(x, y, w, h, roundTop) {
  if (h <= 0) return '';
  const r = roundTop ? Math.min(4, w / 2, h) : 0;
  return `M${x},${y + h}V${y + r}${r ? `Q${x},${y} ${x + r},${y}` : ''}H${x + w - r}${r ? `Q${x + w},${y} ${x + w},${y + r}` : ''}V${y + h}Z`;
}
