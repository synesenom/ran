#!/bin/bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

npm install

# Install CodeScene MCP server globally so cs-mcp is on PATH for the MCP server entry in settings.json.
npm install -g @codescene/codehealth-mcp

# Install the project's stop hook so pipeline working dirs (thoughts/, solutions/)
# are excluded from the untracked-files check, matching local machine behaviour.
cp "$CLAUDE_PROJECT_DIR/.claude/hooks/stop-hook-git-check.sh" ~/.claude/stop-hook-git-check.sh
chmod +x ~/.claude/stop-hook-git-check.sh
