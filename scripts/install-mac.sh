#!/bin/bash
# Sets up the Mac side of tokens.remypost.me:
#   1. copies the exporter, status line and shipper to ~/.local/share/remypost-tokens (outside the repo,
#      so moving or deleting the checkout never breaks the schedule)
#   2. points Claude Code's statusLine at statusline.mjs (backs up settings.json first; never replaces
#      a status line that isn't ours)
#   3. loads the LaunchAgent com.remy.tokens-ship: ship.sh at 00:00 and 12:00 local time
#
#   apps/tokens/scripts/install-mac.sh             install or update
#   apps/tokens/scripts/install-mac.sh --uninstall remove the LaunchAgent and our statusLine entry
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/env.sh"
LABEL=com.remy.tokens-ship
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
SETTINGS="$HOME/.claude/settings.json"
NODE="$(command -v node || echo /opt/homebrew/bin/node)"
STATUS_CMD="$NODE $TOKENS_HOME/statusline.mjs"

# Edit settings.json with Node so the JSON stays valid and every other key is untouched.
set_status_line() {
  node - "$SETTINGS" "$1" "$TOKENS_HOME" <<'JS'
const fs = require('node:fs');
const [file, mode, home] = process.argv.slice(2);
const s = JSON.parse(fs.readFileSync(file, 'utf8'));
const ours = (cmd) => typeof cmd === 'string' && cmd.includes(`${home}/statusline.mjs`);
if (mode === 'remove') {
  if (!ours(s.statusLine?.command)) process.exit(0);
  delete s.statusLine;
} else {
  if (s.statusLine && !ours(s.statusLine.command)) {
    console.error(`settings.json already has a statusLine (${s.statusLine.command}); leaving it alone.`);
    process.exit(0);
  }
  s.statusLine = { type: 'command', command: mode, padding: 0 };
}
fs.copyFileSync(file, `${file}.bak-tokens`);
const tmp = `${file}.tmp-tokens`;
fs.writeFileSync(tmp, JSON.stringify(s, null, 2) + '\n');
fs.renameSync(tmp, file);
console.log(mode === 'remove' ? 'statusLine removed' : 'statusLine set');
JS
}

if [ "${1:-}" = "--uninstall" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  set_status_line remove
  echo "Uninstalled. Data and history stay in $TOKENS_STATE_DIR."
  exit 0
fi

mkdir -p "$TOKENS_HOME" "$TOKENS_STATE_DIR" "$HOME/Library/LaunchAgents"
install -m 644 "$HERE/export-usage.mjs" "$HERE/statusline.mjs" "$HERE/env.sh" "$TOKENS_HOME/"
install -m 755 "$HERE/ship.sh" "$TOKENS_HOME/"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>$TOKENS_HOME/ship.sh</string></array>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Hour</key><integer>0</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>12</integer><key>Minute</key><integer>0</integer></dict>
  </array>
  <key>StandardOutPath</key><string>$TOKENS_STATE_DIR/ship.log</string>
  <key>StandardErrorPath</key><string>$TOKENS_STATE_DIR/ship.log</string>
  <key>ProcessType</key><string>Background</string>
  <key>LowPriorityIO</key><true/>
</dict>
</plist>
PLIST
plutil -lint "$PLIST" >/dev/null
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

set_status_line "$STATUS_CMD"
echo "Installed. Next runs: 00:00 and 12:00. Log: $TOKENS_STATE_DIR/ship.log"
echo "Run one now with: launchctl kickstart gui/$(id -u)/$LABEL"
