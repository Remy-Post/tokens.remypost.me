#!/usr/bin/env node
// Claude Code status line that also remembers your plan limits for tokens.remypost.me.
//
// Claude Code pipes session JSON to this script on every update. For Pro/Max it includes
// rate_limits.five_hour / seven_day (documented: code.claude.com/docs/en/statusline).
// We keep only those numbers and a timestamp; nothing else from stdin is stored.

import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const STATE = process.env.TOKENS_STATE_DIR ?? join(homedir(), '.local/state/remypost-tokens');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  let s = {};
  try { s = JSON.parse(input); } catch { /* print an empty line below */ }

  const rl = s.rate_limits;
  const keep = (w) => (w && { used_percentage: w.used_percentage, resets_at: w.resets_at });
  if (rl?.five_hour || rl?.seven_day) {
    try {
      mkdirSync(STATE, { recursive: true });
      const out = join(STATE, 'limits.json');
      const tmp = `${out}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify({
        capturedAt: new Date().toISOString(),
        rate_limits: { five_hour: keep(rl.five_hour), seven_day: keep(rl.seven_day) },
      }));
      renameSync(tmp, out);
    } catch { /* never break the status line over a write */ }
  }

  const pct = (w) => (Number.isFinite(w?.used_percentage) ? `${Math.round(w.used_percentage)}%` : '–');
  const parts = [s.model?.display_name, rl && `5h ${pct(rl.five_hour)}`, rl && `week ${pct(rl.seven_day)}`];
  process.stdout.write(parts.filter(Boolean).join(' · ') + '\n');
});
