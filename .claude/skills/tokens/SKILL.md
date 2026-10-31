---
name: tokens
description: Operate and check tokens.remypost.me, Remy's Claude Code usage page — whether the twice-daily upload ran, why numbers look stale or wrong, how to publish a new release, refresh the bot list or reinstall the Mac side. Use when Remy says "tokens", "usage page", "is the token tracker updating", "ship the numbers", or after changing anything in apps/tokens.
---

# tokens.remypost.me

Static Preact page on the Oracle VM. The Mac exports counts from Claude Code's transcripts and plan limits from the
status line, then uploads `usage.json` at 00:00 and 12:00. Nothing on the VM runs code for it.

## 1. Health check

Run these, report in plain language, change nothing:

```bash
tail -20 ~/.local/state/remypost-tokens/ship.log
launchctl print gui/$(id -u)/com.remy.tokens-ship | grep -E 'state|last exit|runs'
curl -s https://tokens.remy-post.duckdns.org/data/usage.json | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["generatedAt"], d["range"], d["limits"])'
```

| Symptom | Likely cause | Do |
|---|---|---|
| `generatedAt` older than 13 h | Mac asleep or job failed | read ship.log; `launchctl kickstart gui/$(id -u)/com.remy.tokens-ship` |
| `upload failed` in log | VM unreachable / key missing | `ssh -i ~/.ssh/oci_n8n ubuntu@40.233.100.237 true`; ask before changing keys |
| `limits` null or old | Claude Code not opened since | normal; it fills on the next session |
| totals look off | parser drift after a Claude Code update | compare with `npx ccusage@20.0.46 claude daily --json --offline` |
| page down, data fine | release or Caddy issue | `scripts/vm-setup.sh` then `scripts/deploy.sh` |

## 2. Change and publish

1. Edit in `apps/tokens`, keeping `AGENTS.md` true (light, private, accessible, phone → TV).
2. `npm run build`, then check the five widths with the `device-qa` agent.
3. `scripts/deploy.sh` — it refuses to report success unless the live page serves the new bundle.

## 3. Refresh the crawler list

Regenerate the `@aibots` regex in `deploy/tokens.caddy` from
`https://raw.githubusercontent.com/ai-robots-txt/ai.robots.txt/main/robots.json` (drop generic names like Code,
Cursor, Dot, Operator), then `scripts/vm-setup.sh`. It validates before reloading and restores on failure.

## Always

- Ask before anything that changes the VM, `~/.claude/settings.json`, keys or LaunchAgents.
- Never read the Claude OAuth token or keychain; never put prompts, paths or project names in `usage.json`.
- Never leave fake status-line readings in `~/.local/state/remypost-tokens/limits.json`.
- Say what you checked and what you didn't.
