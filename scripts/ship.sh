#!/bin/bash
# Exports usage.json from Claude Code's logs and sends it to the VM. launchd runs this at 00:00 and 12:00
# (com.remy.tokens-ship); a Mac that was asleep runs it once on wake.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/env.sh"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

mkdir -p "$TOKENS_STATE_DIR"
OUT="$TOKENS_STATE_DIR/usage.json"
echo "── $(date '+%F %T')"
node "$HERE/export-usage.mjs" "$OUT"

# Retry once on a network blip (wake from sleep often comes up before Wi-Fi).
for attempt in 1 2; do
  if "${SSH[@]}" '~/bin/receive-tokens-usage' < "$OUT"; then exit 0; fi
  [ "$attempt" = 1 ] && sleep 60
done
echo "upload failed" >&2
exit 1
