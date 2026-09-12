#!/usr/bin/env bash
# Install (or reinstall) the macOS launchd agent that runs `vitals sync` on a fixed interval.
# Usage: scripts/install-launchd.sh [interval_seconds]   (default 21600 = 6 hours)
set -euo pipefail
PROJECT="$(cd "$(dirname "$0")/.." && pwd)"
UV="$(command -v uv)"
INTERVAL="${1:-21600}"
LABEL="com.wannabe-fit.sync"
DEST="$HOME/Library/LaunchAgents/$LABEL.plist"
mkdir -p "$HOME/Library/LaunchAgents" "$PROJECT/data"
sed -e "s|__UV__|$UV|g" -e "s|__PROJECT__|$PROJECT|g" -e "s|__HOME__|$HOME|g" -e "s|__INTERVAL__|$INTERVAL|g" \
    "$PROJECT/launchd/$LABEL.plist.template" > "$DEST"
launchctl unload "$DEST" 2>/dev/null || true
launchctl load "$DEST"
echo "installed $LABEL: every $INTERVAL s, log at $PROJECT/data/sync.log"
echo "remove with: launchctl unload $DEST && rm $DEST"
