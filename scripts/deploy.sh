#!/bin/bash
# Builds the tokens app and publishes it as a new release on the VM, then checks the live page serves it.
#   apps/tokens/scripts/deploy.sh
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/env.sh"
cd "$HERE/.."

npm ci --no-audit --no-fund
npm run build
# Real data never ships inside a release; the VM keeps it in sites/tokens/data.
rm -rf dist/data
COPYFILE_DISABLE=1 tar --no-mac-metadata --no-xattrs -czf - -C dist . | "${SSH[@]}" '~/bin/publish-tokens'

asset=$(grep -o 'assets/index-[^"]*\.js' dist/index.html | head -1)
if curl -fsS --max-time 15 "$TOKENS_URL/" | grep -q "$asset"; then
  echo "OK   $TOKENS_URL serves $asset"
else
  echo "FAIL $TOKENS_URL does not serve $asset" >&2
  exit 1
fi
