#!/bin/bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

git fetch origin main
git checkout -B main origin/main

npm install

# Install the project's stop hook so pipeline working dirs (thoughts/, solutions/)
# are excluded from the untracked-files check, matching local machine behaviour.
cp "$CLAUDE_PROJECT_DIR/.claude/hooks/stop-hook-git-check.sh" ~/.claude/stop-hook-git-check.sh
chmod +x ~/.claude/stop-hook-git-check.sh
