# ADR-0037: MCP-orchestrated release with workflow finalization

**Date**: 2026-07-20
**Status**: Accepted

## Context

The `/release` skill was written around the `gh` CLI and a local git tag push:
it required a maintainer on a machine with `gh` authenticated, a clean `main`
checkout, and permission to push a `v*` tag. That excludes the environments the
skill is increasingly run from — Claude Code on the web and other MCP-only
sessions — which have no `gh` CLI and are restricted from pushing protected
tags. In those environments the release simply could not be cut.

The GitHub MCP tools available in those sessions can create branches, commit
files, open PRs, and merge PRs, but they have **no** tool to create a git tag,
create/edit a GitHub release, or create/close a milestone. The one publish
trigger — pushing the `v*` tag — was therefore unreachable.

## Decision

Split the release across two actors, matched to what each can do:

- **The `/release` skill, via GitHub MCP**, does everything that is reachable
  through MCP: version decision, the semantic **changelog consolidation** (which
  requires judgement no script can replicate), the version-bump commit, the
  release PR, and the merge to `main`.
- **`.github/workflows/release.yml`** does everything MCP cannot, on a runner
  where `gh`/`npm` exist: create and push the `v*` tag, `npm publish
  --provenance`, cut the GitHub release from the already-consolidated
  `## [version]` changelog section, and rotate the milestone.

The skill hands off by triggering the workflow with `workflow_dispatch`
(`mcp__github__actions_run_trigger`, passing the target `version`). The workflow
is dispatch-only and publishes inline in that run.

Tag creation needs a credential the tag-protection ruleset will honor.
`github-actions[bot]` cannot be added to a repository ruleset's bypass list
(only roles and installed Apps are selectable), so the built-in `GITHUB_TOKEN`
cannot create a `v*` tag. The workflow therefore uses a `RELEASE_TOKEN` secret —
a fine-grained PAT owned by a repo admin (who is in the bypass list) — **solely
for the tag push**; every other step (`npm publish`, GitHub release, milestone
rotation) uses `GITHUB_TOKEN`. The `push: tags: ['v*']` trigger is deliberately
omitted: a PAT-pushed tag would re-fire it and double-publish.

## Consequences

- A release can be cut from any MCP-only environment (web, mobile-driven
  sessions) with no `gh` CLI and no local tag push.
- The intelligent changelog consolidation stays in the skill; the workflow only
  reads the finished section, avoiding a brittle consolidation script.
- Milestone rotation and GitHub-release creation move from the skill into the
  workflow, where the required `gh`/API access actually exists; both are
  idempotent and best-effort.
- New coupling: the workflow trusts that `main`'s `package.json` version matches
  the dispatched `version` (guarded by an explicit check) and that the
  `## [version]` changelog section is present and consolidated before dispatch.
- Requires a `RELEASE_TOKEN` admin PAT secret; without it the dispatch path
  fails at the tag-creation step. The PAT is used only for the tag push, so its
  blast radius is limited to Contents write. If the PAT is given an expiry it
  must be rotated.
- Dropping the `push: tags` trigger removes the local-tag-push fallback; a
  maintainer with a checkout releases via `gh workflow run release.yml` or the
  Actions UI instead.
