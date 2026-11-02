# AGENTS.md — apps/tokens

Rules for coding agents working on tokens.remypost.me. The README explains the system; this is what to keep true.

- **Stay hyper-light.** No new runtime dependencies without a very good reason; no chart, UI, date or state
  libraries. Check `npm run build` output: JS should stay under ~15 KB gzipped.
- **Privacy first.** `usage.json` may only ever hold counts, dates, model ids and the plan-limit reading. Never add
  prompts, file paths, project or session identifiers, even hashed.
- **The exporter has zero dependencies** (`node:` built-ins only) and must stay that way. After changing it, compare
  against `npx ccusage@20.0.46 claude daily --json --offline` (totals within 0.1%).
- **Never read the OAuth token or keychain.** Plan limits come only from the status line's `rate_limits`.
- **Local (Ollama) counts come only from `~/.ollama/logs`.** After changing that parser, check its totals equal
  the sums of `prompt eval time … / N tokens` and `eval time … / N tokens` lines in the same logs.
- **Token tuples** are `[input, output, cacheWrite, cacheRead, thinking, requests]` everywhere. Bump `v` in
  `usage.json` (and `receive-usage`, `App.jsx`) for any breaking shape change.
- **Chart rules:** one axis; bars ≤ 24px with 2px surface gaps; legend for ≥ 2 series; text never in a series colour;
  every chart keeps a keyboard path (roving `listbox` + `aria-activedescendant`) and a table view.
- **Family colours are fixed** (clay → slate → ochre → pine). Validate any change with the dataviz palette validator
  in both themes before shipping.
- **Every component works from 320px to 3840px.** Cards are size containers; prefer `@container` and `cqi` inside a
  card, viewport media queries only for the board grid. QA at 375, 768, 1440, 2560 and 3840, light and dark.
- **Don't touch `apps/site`**, the root `package.json` or the parent Caddy blocks. The tokens Caddy block lives in
  `deploy/tokens.caddy` and only reaches the VM through `scripts/vm-setup.sh`.
- **Never ship test data.** If you fake a status-line reading to test, delete
  `$TOKENS_STATE_DIR/limits.json` afterwards.

Before calling a change done: `npm run build`, open `npm run dev` at the five widths, then `scripts/deploy.sh`
(it fails if the live page doesn't serve the new bundle).
