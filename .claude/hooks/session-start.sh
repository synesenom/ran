#!/bin/bash
set -euo pipefail

# Token check runs in every environment (local + remote) so a missing PAT is
# self-diagnosing. The CodeScene MCP server (launched via npx from .mcp.json)
# authenticates with this token; without it the server starts but every tool
# call fails. It is a per-machine secret and is never committed to the repo.
if [ -z "${CS_ACCESS_TOKEN:-}" ]; then
  echo "[ranjs] CS_ACCESS_TOKEN is not set — the CodeScene MCP server will not authenticate." >&2
  echo "        Create a personal access token at https://codescene.io/users/me/pat" >&2
  echo "        and export CS_ACCESS_TOKEN in your shell profile (e.g. ~/.zshrc)." >&2
fi

# Remaining setup is cloud-only. The cs-mcp binary is a pinned devDependency, so
# `npm install` places it in node_modules/.bin and npx resolves it locally in
# every environment — no global install needed.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

npm install

# Install the project's stop hook so pipeline working dirs (thoughts/, solutions/)
# are excluded from the untracked-files check, matching local machine behaviour.
cp "$CLAUDE_PROJECT_DIR/.claude/hooks/stop-hook-git-check.sh" ~/.claude/stop-hook-git-check.sh
chmod +x ~/.claude/stop-hook-git-check.sh
