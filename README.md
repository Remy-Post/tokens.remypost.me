# tokens.remypost.me

How many tokens I use: Claude Code (cloud) and the local models Ollama runs on the same Mac, plus Max 5x plan
limits, published twice a day. Live at **https://tokens.remypost.me** (staging: https://tokens.remy-post.duckdns.org).

A **Cloud / Local / All** switch at the top re-scopes every section. It opens on Cloud; `?view=local` and
`?view=all` link straight to the others. The switch only appears once the data has a `local` block.

| Section | Shows | Source |
|---|---|---|
| T.1 Volume | All tokens since the first log, what was written, requests, busiest day | transcripts / Ollama logs |
| T.2 Plan limits | 5-hour window and weekly % with reset countdowns (hidden in Local) | Claude Code status line (`rate_limits`) |
| T.3 Calendar | Output per day for the last three months, quiet → busy, with a month-by-month summary | transcripts |
| T.4 Used by model | Output per day over the same three months (per week on narrow screens), stacked by family | transcripts |
| T.5 Hours | Output by hour of day, Eastern, stacked by family (`hoursByModel`) | transcripts |
| T.6 Where tokens go | Cache reads, cache writes, output, fresh input | transcripts |
| T.7 Models | Every model version, every count; hovering a row spotlights its family | transcripts |

## How it works

```
Mac                                                          Oracle VM (Caddy)
───────────────────────────────────────────────              ─────────────────────────────────────────
~/.claude/projects/**/*.jsonl ─┐
~/.ollama/logs/server*.log ────┼─ export-usage.mjs ─ usage.json ─ ssh ─▶ ~/bin/receive-tokens-usage
Claude Code status line ───────┘   (00:00, 12:00 launchd)                  └▶ ~/sites/tokens/data/usage.json
 └ statusline.mjs saves rate_limits                                                │
                                                                                   ▼
apps/tokens (Preact) ── deploy.sh ── tarball ── ssh ─▶ ~/bin/publish-tokens ─▶ ~/sites/tokens/current
                                                                                   │
                                                          https://tokens.remypost.me ◀┘  (static, no server code)
```

- **Counts** come from Claude Code's own transcripts. Each API response is written once per content block, so the
  exporter dedupes on `message.id + requestId` and keeps the final usage. It matches `ccusage` to within 0.01%.
- **Plan limits** come from the `rate_limits` object Claude Code passes to status-line scripts for Pro/Max
  ([docs](https://code.claude.com/docs/en/statusline)). No OAuth token or keychain is ever read. The reading only
  updates while Claude Code is open, so the page says how old it is.
- **Local counts** come from Ollama's server log. Ollama has no usage history or metrics endpoint
  ([docs](https://docs.ollama.com/api/usage) document only the per-response `prompt_eval_count` / `eval_count`), but
  its llama-server runner logs both for every request (`prompt eval time = … / N tokens`, `eval time = … / N tokens`),
  and `template selection model=…` names the model each time one loads. The log counts were checked equal to the
  API's on 2026-11-02, and the parsed totals equal the raw log sums. Model splits rely on
  `OLLAMA_MAX_LOADED_MODELS=1` (set by `~/.n8n-server/bin/ollama-env.sh`); the exporter warns for logs written
  without it. Ollama doesn't log the cached share of a prompt, so local input is the whole prompt and output
  includes thinking. Ollama's newer engine (safetensors builds such as `*-mxfp8`) logs only each request's path and
  duration, so those requests are counted as uncounted in `ship.log` and left out (17 on 2026-10-29, none since).
  Nothing new runs: no proxy, no repointed credentials, about 1 s of parsing per export.
- **History never shrinks.** Claude Code prunes old transcripts and Ollama keeps only six logs (rotated on restart);
  every export merges into `~/.local/state/remypost-tokens/history.json` first. Local history is kept per log file,
  keyed by the file's first timestamp, so a rotated-away log keeps its last count.
- **Only totals leave the Mac:** no prompts, file paths, project names or session ids.

Stack: Preact 11 + Vite 8 (Vite's own JSX transform, no framework plugin), hand-drawn SVG, CSS container queries.
Self-hosted Archivo, Newsreader and Fragment Mono. **12.8 KB JS + 4.4 KB CSS gzipped**, 19 npm packages in total.

```
apps/tokens/
├── src/              App.jsx, components/ (one per section), lib/ (data, format, hooks), styles.css
├── public/           robots.txt, favicon.svg, data/usage.json (dev only, git-ignored)
├── scripts/          export-usage.mjs, statusline.mjs, ship.sh, deploy.sh, vm-setup.sh, install-mac.sh, env.sh
├── deploy/           tokens.caddy, publish-tokens, receive-usage (installed on the VM by vm-setup.sh)
└── .claude/          skills/tokens (operating guide), agents/ (device-qa, data-auditor)
```

## Develop

```bash
cd apps/tokens
npm ci
node scripts/export-usage.mjs        # writes public/data/usage.json from your own logs
npm run dev                          # http://localhost:5174
```

Check every change at phone (375), tablet (768), laptop (1440), monitor (2560) and TV (3840) widths, in light and
dark. Each card is a size container, so it adapts to its own width, not the window's.

## Instances

| Instance | URL | Serves | Updated by |
|---|---|---|---|
| dev | http://localhost:5174 | `public/data/usage.json` from your logs | `node scripts/export-usage.mjs` |
| staging | https://tokens.remy-post.duckdns.org | same release and data as prod | `scripts/deploy.sh`, `ship.sh` |
| prod | https://tokens.remypost.me | `~/sites/tokens/current` + `~/sites/tokens/data` | same |

Both hostnames share one Caddy block (`import tokens`), so staging is always exactly what prod serves.
`tokens.remypost.me` goes live as soon as its DNS record exists (see below); Caddy issues the certificate itself.

| Setting | Where | Purpose |
|---|---|---|
| `TOKENS_HOST` | env / `scripts/env.sh` | `ubuntu@40.233.100.237` |
| `TOKENS_KEY` | env / `scripts/env.sh` | SSH key, default `~/.ssh/oci_n8n` |
| `TOKENS_STATE_DIR` | env | `~/.local/state/remypost-tokens` (history, limits, ship.log) |
| `TOKENS_URL` | env / `scripts/env.sh` | page `deploy.sh` checks, default `https://tokens.remypost.me` |
| `TOKENS_OLLAMA_LOGS` | env | `~/.ollama/logs` |
| `TOKENS_TZ`, `TOKENS_PLAN` | env | `America/Toronto`, `Max 5x` |

## Deploy

| Task | Command |
|---|---|
| First-time VM setup (idempotent) | `scripts/vm-setup.sh` |
| Publish a new release | `scripts/deploy.sh` (builds, uploads, checks the live page serves the new bundle) |
| Mac schedule + status line | `scripts/install-mac.sh` (`--uninstall` reverses it) |
| Send numbers now | `launchctl kickstart gui/$(id -u)/com.remy.tokens-ship` |
| Watch the schedule | `tail -f ~/.local/state/remypost-tokens/ship.log` |
| Roll back a release | `ssh ubuntu@40.233.100.237 'cd ~/sites/tokens && ls releases && ln -sfn releases/<name> current'` |

`vm-setup.sh` rewrites only the `# BEGIN tokens … # END tokens` block of the shared Caddyfile, validates it inside the
Caddy container, and restores the previous file if validation fails. The last three Caddyfiles are kept as
`Caddyfile.bak-tokens-*`. Five releases are kept.

**DNS (Namecheap → Advanced DNS):** add an `A` record, host `tokens`, value `40.233.100.237`.

## Bots

Public for people, closed to crawlers. All stock Caddy, nothing extra running on the VM:

- `robots.txt` disallows everything; every response carries `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex, noai, noimageai`.
- 185 self-identified AI crawlers (from [ai-robots-txt](https://github.com/ai-robots-txt/ai.robots.txt), generic names such as "Code" or "Cursor" removed so real browsers never match) have the connection dropped.
- A honeypot link (`/archive/`), hidden from people and disallowed in robots.txt, drops anything that follows it.
- Strict CSP (`default-src 'none'`, scripts, styles and fonts from self only), HSTS, `frame-ancestors 'none'`.

To refresh the crawler list, regenerate the `@aibots` line in `deploy/tokens.caddy` from the repo's `robots.json`
and re-run `scripts/vm-setup.sh`.

## Decisions worth knowing

- **Own exporter, not ccusage.** ccusage is good (MIT, SLSA provenance) but now ships a native binary and fetches
  pricing over the network by default. A zero-dependency script nobody else can update is the safer thing to run
  unattended over my transcripts. ccusage stays useful as a manual cross-check:
  `npx ccusage@20.0.46 claude daily --json --offline`.
- **Status line, not the OAuth usage endpoint.** The endpoint is undocumented and needs the account-wide OAuth token.
  The status line is documented and hands over the percentages itself.
- **Static, not live.** Two uploads a day, so the VM serves files and runs no code for this. OpenTelemetry would
  give near-real-time and multi-machine numbers at the cost of a collector service; it's the path if that's ever wanted.
- **Upload key.** `ship.sh` uses the existing `oci_n8n` key, which has full shell access. A dedicated key limited with
  `restrict,command="~/bin/receive-tokens-usage"` in `authorized_keys` would cap a leaked key to replacing one JSON file.
- **Chart colours** were validated for colour-blind separation in both themes. The family order
  Opus → Sonnet → Fable → Haiku (clay → slate → ochre → pine) is the one that passes; don't reshuffle it.
  Colours are slots (`--fam-1…4`): Local fills them with its top four families by output in that same order
  (the rest stack as a fixed grey Other, so bars always add up), and All uses slots 1-2 for Claude and Local.
- **Local from logs, not a proxy or n8n.** A counting proxy in front of Ollama would read the documented fields but
  adds a process in the request path and means repointing every n8n credential. n8n can't see the Mac's files
  (it runs in Docker, and Execute Command is disabled by default in 2.x), and only some local calls go through it.
- **No theme toggle.** The page follows the system setting, so no inline script is needed and the CSP stays strict.
