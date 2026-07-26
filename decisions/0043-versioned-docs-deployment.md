# ADR-0043: Versioned API docs deployment

**Date**: 2026-07-26
**Status**: Accepted

## Context

`docs-deploy` in `.github/workflows/ci.yml` redeployed the entire GitHub Pages
site on every push to `main`, using `documentation.js`'s output built from
whatever was on `main` at that instant. `docs/index.js` reads `VERSION` from
`package.json` only to build GitHub source permalinks
(`https://github.com/synesenom/ran/blob/v${VERSION}/...`); it never
influenced *which* commit's source got documented. Since `main`'s
`package.json` version stays pinned at the last released version until a
release PR bumps it (see "Versioning and Changelog" in `CLAUDE.md`), the
live site could — and did — end up documenting distributions and methods
added since the last tag (e.g. `Tweedie`, #1136) while still emitting
permalinks pointing at a tag that predates that code. There was no way to
see the docs for a past release, and no way to preview in-progress work
without a laptop able to run `npm run docs` locally.

## Decision

Deployment moves from the single-shot `actions/deploy-pages` build-type to a
persistent, accumulating `gh-pages` branch (GitHub Pages source: "Deploy
from a branch"), laid out as:

- `/` — mirror of the latest tagged release (what most visitors land on)
- `/vX.Y.Z/` — one directory per published release tag, written once and
  never rebuilt
- `/unreleased/` — rebuilt on every push to `main`, documenting tip-of-`main`
- `/versions.json` — a manifest (`{ latest, versions: [...] }`) regenerated
  on every deploy by `scripts/build-docs-versions-manifest.js`

A new `.github/workflows/docs-deploy.yml` triggers on `push: branches:
[main]` (→ `unreleased/`) and `push: tags: ['v*']` (→ `vX.Y.Z/` + root). It
checks out (or initializes) the `gh-pages` branch as a git worktree, writes
only its own target directory (and, on a tag, the root), regenerates
`versions.json`, commits, and pushes — so each run only ever touches its own
channel, leaving every other version's files untouched. `docs-build` in
`ci.yml` keeps running on every push/PR as a pure build-sanity check (no
deploy), so a broken doc build still fails CI before merge.

`docs/index.js` gains a `RANJS_DOCS_CHANNEL` env var (defaulting to
`unreleased` for local `npm run docs` runs) that is threaded into every
rendered page as `channel`. `docs/templates/_layout.pug` stamps
`data-ranjs-channel` on `<html>`; `docs/assets/version-switcher.js` fetches
`versions.json` from a hardcoded Pages base URL at page-load, populates a
version dropdown, and renders an "unreleased" banner (channel === the
literal string `unreleased`) or an "outdated version" banner (channel !==
`versions.json`'s `latest`) — both linking back to `/`. Because this is
resolved client-side against the live manifest, old frozen `/vX.Y.Z/` pages
correctly detect that they've become outdated as later releases ship,
without ever being rebuilt.

## Consequences

- The live docs site (`/`) only ever reflects a tagged release; unreleased
  work is visible only at the explicit, clearly-banner-labeled `/unreleased/`
  path — matching the NumPy/SciPy/pandas `devdocs` convention this project's
  versioning policy already follows (NEP 23 / SPEC 0, see "Versioning and
  Changelog" in `CLAUDE.md`).
- Every past release's docs remain permanently reachable at `/vX.Y.Z/`,
  each with correct GitHub source permalinks for that exact tag.
- GitHub Pages source must be switched (one-time, manual) from "GitHub
  Actions" to "Deploy from a branch: `gh-pages`" in repository Settings —
  no tool used by this session can change that setting, so a human with
  repo admin access has to flip it.
- Deploys are no longer atomic across the whole site: a failed or partial
  `docs-deploy.yml` run could in principle leave `gh-pages` with a stale
  `unreleased/` next to a fresh `vX.Y.Z/`, or vice versa. Each channel's
  directory is still internally consistent (written by a single `cp -r` from
  one build), so the worst case is one channel lagging by one deploy, not a
  mixed-version page.
- `scripts/build-docs-versions-manifest.js` and
  `docs/assets/version-switcher.js` fix the manifest schema
  (`{ latest, versions }`); changing it later must stay backward-compatible
  enough that already-published `/vX.Y.Z/` pages (whose switcher script is
  frozen at build time) don't break when fetching a newer `versions.json`.
