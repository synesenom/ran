---
date: 2026-05-16T17:30:40Z
category: "tooling"
problem: "docs/index.html tracked in git caused silent drift; upload-artifact@v4 is not consumable by deploy-pages@v4"
status: complete
related_issue: "#167"
related_plan: "thoughts/plans/2026-05-16-1730-docs-pages-deploy.md"
tags: [github-actions, github-pages, gitignore, build-artifacts, ci, docs-deploy]
---

# Solution: GitHub Pages deployment requires upload-pages-artifact, not upload-artifact

**Date**: 2026-05-16T17:30:40Z
**Category**: tooling
**Related Issue**: #167

## Problem

`docs/index.html` was committed to git alongside its source files. Because it was only regenerated manually before each commit, JSDoc edits not followed by `npm run docs` left the committed HTML silently stale — rendered docs diverged from source without any CI signal. The `docs-build` CI job also used `actions/upload-artifact@v4`, which produces a generic downloadable artifact that `actions/deploy-pages@v4` cannot consume, making automated Pages deployment impossible regardless of what deploy job was added.

## Root Cause

Two compounding mistakes. First, a build artifact with no mandatory-regeneration enforcement was tracked in git — the same exclusion already applied to `docs/styles/style.css` was never applied to `docs/index.html` when it was first committed.

Second, `actions/upload-artifact@v4` and `actions/upload-pages-artifact@v3` look superficially interchangeable (both upload files from CI) but are not: `actions/deploy-pages@v4` hardcodes the artifact name `github-pages` and requires the OIDC handshake that only `upload-pages-artifact` sets up. A generic artifact named `docs` is invisible to it.

## Fix

1. `git rm --cached docs/index.html` — removed from index without deleting the local file.
2. Added `/docs/index.html` to `.gitignore` alongside its already-ignored sibling `/docs/styles/style.css`.
3. Replaced the `actions/upload-artifact@v4` step in `docs-build` with `actions/upload-pages-artifact@v3` (no `name` parameter; always produces the reserved `github-pages` artifact; `path: ./docs`).
4. Added a `docs-deploy` job:
   - `needs: [docs-build]`
   - `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`
   - `permissions: pages: write` and `id-token: write`
   - `environment: name: github-pages`
   - `uses: actions/deploy-pages@v4`

The one-time manual prerequisite: repo Settings → Pages → Source must be switched from "Deploy from a branch" to "GitHub Actions" before the first deploy run.

## Prevention Strategy

- Treat all compiled outputs (`*.html`, `*.css`, compiled JS bundles) as build artifacts by default. When `.gitignore`-ing one output from a build step, audit the same build step for sibling outputs and exclude them all at once.
- When wiring up a GitHub Pages pipeline, use `upload-pages-artifact@v3` from the start rather than repurposing a generic `upload-artifact` step — they are not drop-in substitutes.
- Gate `docs-deploy` to `push` to `main` only (not on PRs), and declare `permissions` at the job level to follow least-privilege.

## Related Solutions

None found.

## Key Insight

`actions/deploy-pages@v4` only consumes artifacts created by `actions/upload-pages-artifact@v3` (which always names the artifact `github-pages`); passing it a generic `upload-artifact@v4` artifact silently fails because the Pages deploy action locates its input by the reserved name, not by an explicit reference.
