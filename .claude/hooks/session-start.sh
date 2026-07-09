#!/bin/bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

npm install

# Install CodeScene MCP server globally so cs-mcp is on PATH for the MCP server entry in settings.json.
npm install -g @codescene/codehealth-mcp

# Pre-warm the cs-mcp binary. npm install -g above reinstalls the package,
# wiping the .cache/ directory where the downloaded binary lives. Running
# --version triggers the download now so the MCP server starts instantly
# rather than racing against a 30-second cold download at session init.
cs-mcp --version >/dev/null 2>&1

# Install the project's stop hook so pipeline working dirs (thoughts/, solutions/)
# are excluded from the untracked-files check, matching local machine behaviour.
cp "$CLAUDE_PROJECT_DIR/.claude/hooks/stop-hook-git-check.sh" ~/.claude/stop-hook-git-check.sh
chmod +x ~/.claude/stop-hook-git-check.sh
