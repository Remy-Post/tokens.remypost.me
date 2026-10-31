#!/bin/bash
# One-time (and safe to re-run) VM setup for tokens: installs the two server scripts into ~/bin and
# swaps the "tokens" block in the shared Caddyfile. Caddy validates the result before it reloads,
# and a failed validation puts the previous Caddyfile back.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/env.sh"
DEPLOY="$HERE/../deploy"

"${SSH[@]}" 'mkdir -p ~/bin ~/sites/tokens/releases ~/sites/tokens/data && cat > ~/bin/publish-tokens && chmod 755 ~/bin/publish-tokens' < "$DEPLOY/publish-tokens"
"${SSH[@]}" 'cat > ~/bin/receive-tokens-usage && chmod 755 ~/bin/receive-tokens-usage' < "$DEPLOY/receive-usage"
"${SSH[@]}" 'cat > /tmp/tokens.caddy' < "$DEPLOY/tokens.caddy"

"${SSH[@]}" 'bash -s' <<'REMOTE'
set -euo pipefail
cd ~/n8n
backup="caddy/Caddyfile.bak-tokens-$(date -u +%Y%m%d-%H%M%S)"
cp caddy/Caddyfile "$backup"
ls -1t caddy/Caddyfile.bak-tokens-* | tail -n +4 | xargs -r rm -f

# Our block runs from "# BEGIN tokens" to "# END tokens". On the first run it started at the
# placeholder comment "# tokens.remypost.me" and ran to the end of the file.
python3 -I - caddy/Caddyfile /tmp/tokens.caddy <<'PY'
import sys
path, block_path = sys.argv[1], sys.argv[2]
src = open(path).read()
block = open(block_path).read().strip() + "\n"
start = src.find("# BEGIN tokens")
if start < 0:
    start = src.find("# tokens.remypost.me")
if start < 0:
    before, after = src.rstrip() + "\n\n", ""
else:
    end = src.find("# END tokens", start)
    before = src[:start]
    after = "" if end < 0 else src[end + len("# END tokens"):].lstrip("\n")
out = before + block + ("\n" + after if after else "")
open(path, "w").write(out)
PY

if docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; then
  docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
  echo "caddy reloaded"
else
  cp "$backup" caddy/Caddyfile
  echo "validation failed; previous Caddyfile restored" >&2
  exit 1
fi
rm -f /tmp/tokens.caddy
REMOTE
