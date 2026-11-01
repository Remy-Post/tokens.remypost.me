#!/usr/bin/env node
// Turns Claude Code's local transcripts into the small public usage.json that tokens.remypost.me reads.
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
    byDay.set(x.d, { d: x.d, m, s: Math.max(old.s, x.s), sub: Math.max(old.sub, x.sub), h: maxOf(old.h, x.h), hm });
  }
  return [...byDay.values()].sort((a, b) => a.d.localeCompare(b.d));
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
await writeAtomic(HISTORY, JSON.stringify({ v: 2, days: kept }));

const hours = Array(24).fill(0);
const hoursByModel = {};
for (const day of kept) {
  (day.h ?? []).forEach((v, i) => (hours[i] += v));
  for (const [model, h] of Object.entries(day.hm ?? {})) {
    const acc = (hoursByModel[model] ??= Array(24).fill(0));
    h.forEach((v, i) => (acc[i] += v));
  }
}
// Days recorded before per-model hours existed only have totals; whatever hours can't be split stay out of
// hoursByModel, and the page shows the difference from `hours` as unsplit.
const days = kept.map(({ h, hm, ...day }) => day); // the public file gets the hour totals, not each day's hours

const totals = zero();
const byModel = {};
for (const day of days) {
  for (const [model, t] of Object.entries(day.m)) {
    for (let i = 0; i < 6; i++) totals[i] += t[i];
    byModel[model] = (byModel[model] ?? zero()).map((v, i) => v + t[i]);
  }
}

const usage = {
  v: 1,
  generatedAt: new Date().toISOString(),
  tz: TZ,
  plan: PLAN,
  source: 'Claude Code transcripts on one Mac',
  fields: ['input', 'output', 'cacheWrite', 'cacheRead', 'thinking', 'requests'],
  range: days.length ? { from: days[0].d, to: days.at(-1).d } : null,
  totals,
  models: byModel,
  days,
  hours,
  hoursByModel,
  limits: pickLimits(await readJson(LIMITS)),
};

await writeAtomic(OUT, JSON.stringify(usage));
const ms = Math.round(performance.now() - started);
console.log(`usage.json: ${days.length} days, ${records.length} responses from ${files} files in ${ms} ms -> ${OUT}`);
