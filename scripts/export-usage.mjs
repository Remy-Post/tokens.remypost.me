#!/usr/bin/env node
// Turns Claude Code's local transcripts (cloud) and Ollama's server logs (local models) into the small public
// usage.json that tokens.remypost.me reads.
//
//   node scripts/export-usage.mjs [out.json]      (default: public/data/usage.json, for npm run dev)
//
// Only counts leave this machine: no prompts, paths, project names or session ids are ever written.
// Zero dependencies on purpose: nothing third-party gets to read the transcripts.

import { createReadStream } from 'node:fs';
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(process.argv[2] ?? fileURLToPath(new URL('../public/data/usage.json', import.meta.url)));
const TZ = process.env.TOKENS_TZ ?? 'America/Toronto';
const PLAN = process.env.TOKENS_PLAN ?? 'Max 5x';
const STATE = process.env.TOKENS_STATE_DIR ?? join(homedir(), '.local/state/remypost-tokens');
// Claude Code prunes old transcripts, so every export is merged into a local history that never shrinks.
const HISTORY = join(STATE, 'history.json');
const LIMITS = join(STATE, 'limits.json');
const OLLAMA_LOGS = process.env.TOKENS_OLLAMA_LOGS ?? join(homedir(), '.ollama/logs');

// Same lookup order Claude Code uses: CLAUDE_CONFIG_DIR (comma-separated) or ~/.claude and ~/.config/claude.
const roots = (process.env.CLAUDE_CONFIG_DIR?.split(',') ?? [join(homedir(), '.claude'), join(homedir(), '.config/claude')])
  .map((dir) => join(dir.trim(), 'projects'));

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' });

async function* jsonlFiles(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* jsonlFiles(p);
    else if (e.name.endsWith('.jsonl')) yield p;
  }
}

/** One assistant API response. Claude Code writes a line per content block, all sharing message.id + requestId. */
function toRecord(line) {
  if (!line.includes('"usage"') || !line.includes('"assistant"')) return null; // cheap pre-filter, most lines skip JSON.parse
  let row;
  try { row = JSON.parse(line); } catch { return null; }
  const msg = row.message;
  const u = msg?.usage;
  if (row.type !== 'assistant' || !u || row.isApiErrorMessage) return null;
  if (!msg.model || msg.model === '<synthetic>' || !row.timestamp) return null;
  return {
    key: `${msg.id ?? row.uuid}:${row.requestId ?? ''}`,
    ts: row.timestamp,
    model: msg.model.replace(/-\d{8}$/, ''), // claude-haiku-4-5-20251001 -> claude-haiku-4-5
    session: row.sessionId,
    sub: Boolean(row.isSidechain),
    t: [
      u.input_tokens ?? 0,
      u.output_tokens ?? 0,
      u.cache_creation_input_tokens ?? 0,
      u.cache_read_input_tokens ?? 0,
      u.output_tokens_details?.thinking_tokens ?? 0,
    ],
  };
}

async function scan() {
  const seen = new Map();
  let files = 0;
  for (const root of roots) {
    for await (const file of jsonlFiles(root)) {
      files++;
      const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
      for await (const line of rl) {
        const r = toRecord(line);
        if (!r) continue;
        const prev = seen.get(r.key);
        // Streaming snapshots repeat the usage; the one with the most output is the final count.
        if (!prev || r.t[1] > prev.t[1]) seen.set(r.key, r);
      }
    }
  }
  return { records: [...seen.values()], files };
}

// Token tuple order everywhere: [input, output, cacheWrite, cacheRead, thinking, requests]
const add = (a, t) => { for (let i = 0; i < 5; i++) a[i] += t[i]; a[5] += 1; return a; };
const zero = () => [0, 0, 0, 0, 0, 0];

function aggregate(records) {
  const days = new Map();
  for (const r of records) {
    const date = new Date(r.ts);
    const d = dayFmt.format(date);
    let day = days.get(d);
    if (!day) days.set(d, (day = { d, m: {}, sessions: new Set(), sub: 0, h: Array(24).fill(0), hm: {} }));
    add((day.m[r.model] ??= zero()), r.t);
    day.sessions.add(r.session);
    if (r.sub) day.sub++;
    const hour = Number(hourFmt.format(date)) % 24;
    day.h[hour] += r.t[1];
    (day.hm[r.model] ??= Array(24).fill(0))[hour] += r.t[1];
  }
  // h and hm (output per hour of that day, total and per model) stay in the private history only,
  // so the hour charts can be rebuilt exactly. The public file gets hour totals across all days.
  return [...days.values()].map((x) => ({ d: x.d, m: x.m, s: x.sessions.size, sub: x.sub, h: x.h, hm: x.hm }));
}

async function readJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; }
}

async function writeAtomic(path, data) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, data);
  await rename(tmp, path);
}

/**
 * Claude Code prunes transcripts one session file at a time, so a day can lose some of its files and keep others.
 * A day's true count never goes down, so every field keeps the larger of history and the fresh scan:
 * today's growing numbers win, and a partly pruned day keeps what it had.
 */
const maxOf = (a = [], b = []) => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => Math.max(a[i] ?? 0, b[i] ?? 0));
function merge(historyDays, freshDays) {
  const byDay = new Map((historyDays ?? []).map((x) => [x.d, x]));
  for (const x of freshDays) {
    const old = byDay.get(x.d);
    if (!old) { byDay.set(x.d, x); continue; }
    const m = { ...old.m };
    for (const [model, t] of Object.entries(x.m)) m[model] = maxOf(old.m[model], t);
    const hm = { ...old.hm };
    for (const [model, h] of Object.entries(x.hm ?? {})) hm[model] = maxOf(old.hm?.[model], h);
    // Each model's hours keep their own maximum, so the hour total must never fall below their sum.
    const split = Array.from({ length: 24 }, (_, i) => Object.values(hm).reduce((sum, h) => sum + (h[i] ?? 0), 0));
    byDay.set(x.d, { d: x.d, m, s: Math.max(old.s, x.s), sub: Math.max(old.sub, x.sub), h: maxOf(maxOf(old.h, x.h), split), hm });
  }
  return [...byDay.values()].sort((a, b) => a.d.localeCompare(b.d));
}

/**
 * Local models. Ollama has no usage history or metrics endpoint (docs.ollama.com/api/usage documents only the
 * per-response prompt_eval_count / eval_count), but its llama-server runner logs the same two counts for every
 * request, and those were checked equal to the API's on 2026-11-02:
 *
 *   msg="template selection" model=registry.ollama.ai/library/qwen3.5:9b   <- a model was just loaded
 *   slot print_timing: … | prompt eval time = 359.30 ms /   366 tokens    <- prompt_eval_count
 *   slot print_timing: … |        eval time = 4744.41 ms /  213 tokens    <- eval_count
 *   [GIN] 2026/10/30 - 17:57:19 | 200 | 6.65s | 127.0.0.1 | POST "/api/chat"   <- request done (local time)
 *
 * With OLLAMA_MAX_LOADED_MODELS=1 only one model is resident, so every request belongs to the model loaded last.
 * Ollama's newer engine (safetensors builds such as *-mxfp8) logs only `msg=ServeHTTP method=POST … took=…`, with no
 * token counts; those requests are counted and reported as uncounted, never guessed.
 * Ollama keeps server.log plus server-1…5.log and rotates on restart; each file is keyed by its first timestamp
 * (the server's start), so a rotated file keeps its key and a file that rotates away keeps its last count.
 */
const OLLAMA_LINE = {
  model: /msg="template selection" model=(\S+)/,
  slot: /^slot print_timing: id\s+(\d+) \|/,
  prompt: /\| prompt eval time = .*?\/\s*(\d+) tokens/,
  eval: /\|\s+eval time = .*?\/\s*(\d+) tokens/,
  done: /^\[GIN\] (\d{4})\/(\d\d)\/(\d\d) - (\d\d):(\d\d):(\d\d) \|\s*\d{3} \|.*\|\s*POST\s+"/,
  start: /^time=(\S+)/,
  newEngine: /msg=ServeHTTP method=POST /,
  maxLoaded: /OLLAMA_MAX_LOADED_MODELS:(\d+)/,
};

/**
 * registry.ollama.ai/library/qwen3.5:9b -> qwen3.5:9b, llama3.2:latest -> llama3.2, hf.co/a/b:q4 -> b:q4.
 * Always returns an id the VM validator accepts: odd characters become '-', long names are cut, never dropped.
 */
function localModel(name) {
  const [base = '', tag] = name.split('/').at(-1).toLowerCase().replace(/:latest$/, '').split(':');
  const clean = (s, n) => s.replace(/[^a-z0-9._-]/g, '-').slice(0, n);
  const id = clean(base, 41).replace(/^[^a-z0-9]+/, '') || 'unknown';
  return tag ? `${id}:${clean(tag, 40)}` : id;
}

async function scanOllamaFile(file) {
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  let key = null, model = null, multi = false, uncounted = 0;
  // With OLLAMA_NUM_PARALLEL > 1 two slots' blocks interleave, so blocks are kept per slot until their eval
  // line, then queued; each finished POST takes the oldest finished block and gives it its time.
  const open = new Map();
  const done = [];
  const records = [];
  for await (const line of rl) {
    // The file's key is its first timestamp (the server's start); a stray first line doesn't hide the rest.
    if (key === null) key = OLLAMA_LINE.start.exec(line)?.[1] ?? null;
    // Cheap pre-filter: almost every line is a model-load dump or an /api/ps poll.
    if (line.startsWith('slot print_timing')) {
      const slot = OLLAMA_LINE.slot.exec(line)?.[1];
      const p = OLLAMA_LINE.prompt.exec(line);
      if (p) { open.set(slot, { model, prompt: Number(p[1]) }); continue; }
      const e = OLLAMA_LINE.eval.exec(line);
      const block = open.get(slot);
      if (e && block) {
        open.delete(slot);
        if (block.model) done.push({ ...block, out: Number(e[1]) });
      }
    } else if (line.startsWith('[GIN]')) {
      const g = done.length && OLLAMA_LINE.done.exec(line);
      if (!g) continue;
      const b = done.shift();
      const [, y, mo, d, h, mi, s] = g.map(Number);
      records.push({ ts: new Date(y, mo - 1, d, h, mi, s), model: b.model, t: [b.prompt, b.out, 0, 0, 0] });
    } else if (line.includes('msg="template selection"')) {
      model = localModel(OLLAMA_LINE.model.exec(line)?.[1] ?? '');
    } else if (OLLAMA_LINE.newEngine.test(line)) {
      uncounted++;
    } else if (line.includes('msg="server config"')) {
      multi = Number(OLLAMA_LINE.maxLoaded.exec(line)?.[1] ?? 1) !== 1;
    }
  }
  if (multi && records.length) console.warn(`${file}: OLLAMA_MAX_LOADED_MODELS is not 1, so per-model splits may be off`);
  return { key, records, uncounted };
}

async function scanOllama() {
  let names;
  try { names = await readdir(OLLAMA_LOGS); } catch { return []; }
  const files = [];
  for (const name of names.filter((x) => /^server(-\d+)?\.log$/.test(x))) {
    const { key, records, uncounted } = await scanOllamaFile(join(OLLAMA_LOGS, name));
    if (key) files.push({ key, records, uncounted });
    else if (records.length) console.warn(`${name}: no timestamp line, so its ${records.length} requests can't be kept`);
  }
  return files;
}

/** Days (with private per-hour detail) for local requests: the cloud history's shape, with no sessions. */
function aggregateLocal(records) {
  return aggregate(records.map((r) => ({ ...r, session: null, sub: false }))).map((day) => ({ ...day, s: 0, sub: 0 }));
}

/** Sums days that appear in more than one log file (a restart in the middle of a day). */
function sumDays(lists) {
  const byDay = new Map();
  for (const days of lists) {
    for (const x of days) {
      let acc = byDay.get(x.d);
      if (!acc) byDay.set(x.d, (acc = { d: x.d, m: {}, h: Array(24).fill(0), hm: {} }));
      for (const [model, t] of Object.entries(x.m)) {
        const a = (acc.m[model] ??= zero());
        t.forEach((v, i) => (a[i] += v));
      }
      x.h.forEach((v, i) => (acc.h[i] += v));
      for (const [model, h] of Object.entries(x.hm)) {
        const a = (acc.hm[model] ??= Array(24).fill(0));
        h.forEach((v, i) => (a[i] += v));
      }
    }
  }
  return [...byDay.values()].sort((a, b) => a.d.localeCompare(b.d));
}

/** The public part of a list of history days: totals per model, hours across all days, days without hours. */
function publish(kept) {
  const hours = Array(24).fill(0);
  const hoursByModel = {};
  for (const day of kept) {
    (day.h ?? []).forEach((v, i) => (hours[i] += v));
    for (const [model, h] of Object.entries(day.hm ?? {})) {
      const acc = (hoursByModel[model] ??= Array(24).fill(0));
      h.forEach((v, i) => (acc[i] += v));
    }
  }
  const days = kept.map(({ h, hm, ...day }) => day); // the public file gets the hour totals, not each day's hours
  const totals = zero();
  const models = {};
  for (const day of days) {
    for (const [model, t] of Object.entries(day.m)) {
      for (let i = 0; i < 6; i++) totals[i] += t[i];
      models[model] = (models[model] ?? zero()).map((v, i) => v + t[i]);
    }
  }
  return { range: days.length ? { from: days[0].d, to: days.at(-1).d } : null, totals, models, days, hours, hoursByModel };
}

function pickLimits(raw) {
  if (!raw?.rate_limits) return null;
  const win = (w) => (w && Number.isFinite(w.used_percentage) ? { pct: w.used_percentage, resetsAt: w.resets_at ?? null } : null);
  return {
    capturedAt: raw.capturedAt,
    fiveHour: win(raw.rate_limits.five_hour),
    sevenDay: win(raw.rate_limits.seven_day),
  };
}

const started = performance.now();
const { records, files } = await scan();
const history = await readJson(HISTORY);
const kept = merge(history?.days, aggregate(records));

// Local: one entry per Ollama log file. A file only grows until it rotates away, so each file's entry is
// max-merged with what it had; files no longer on disk keep their last count.
const ollama = await scanOllama();
const localFiles = { ...history?.local?.files };
for (const { key, records: rs } of ollama) localFiles[key] = merge(localFiles[key], aggregateLocal(rs));
const localKept = sumDays(Object.values(localFiles));
await writeAtomic(HISTORY, JSON.stringify({ v: 2, days: kept, local: { files: localFiles } }));

// Days recorded before per-model hours existed only have totals; whatever hours can't be split stay out of
// hoursByModel, and the page shows the difference from `hours` as unsplit.
const cloud = publish(kept);
const local = publish(localKept);

const usage = {
  v: 1,
  generatedAt: new Date().toISOString(),
  tz: TZ,
  plan: PLAN,
  source: 'Claude Code transcripts on one Mac',
  fields: ['input', 'output', 'cacheWrite', 'cacheRead', 'thinking', 'requests'],
  ...cloud,
  limits: pickLimits(await readJson(LIMITS)),
  // Optional, so pages and validators from before it simply ignore it. Same tuple order; input is the whole
  // prompt (Ollama doesn't log what came from cache) and output includes any thinking.
  ...(local.range && { local: { source: 'Ollama server logs on the same Mac', ...local } }),
};

await writeAtomic(OUT, JSON.stringify(usage));
const ms = Math.round(performance.now() - started);
const localN = ollama.reduce((s, f) => s + f.records.length, 0);
const uncounted = ollama.reduce((s, f) => s + f.uncounted, 0);
if (uncounted) console.warn(`${uncounted} requests on Ollama's newer engine logged no token counts and are not included`);
console.log(
  `usage.json: ${cloud.days.length} days, ${records.length} responses from ${files} files; ` +
    `local ${local.days.length} days, ${localN} requests from ${ollama.length} logs in ${ms} ms -> ${OUT}`,
);
