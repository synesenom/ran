---
date: 2026-07-26T16:30:00Z
category: "tooling"
problem: "npm run standard/lint silently skipped every top-level file in src/ and test/ for an unknown period"
status: complete
related_issue: "#1144"
related_plan: "thoughts/plans/2026-07-26-1245-anderson-darling-public-test.md"
tags: [tooling, lint, standard, glob, globstar, shell-quoting, npm-scripts, package.json]
---

# Solution: unquoted `**` glob in `lint`/`standard` npm scripts silently skipped top-level `src/`/`test/` files

**Date**: 2026-07-26T16:30:00Z
**Category**: tooling
**Related Issue**: #1144

## Problem

`npm run standard` and `npm run lint` reported zero errors repo-wide, yet running `standard` scoped directly at a single top-level file (`test/ad.js`) surfaced a real, live `no-loss-of-precision` violation on an over-precision numeric literal. The full-repo script and the single-file invocation disagreed on the same file, with no error, warning, or non-zero exit code from the full-repo run to reveal the gap.

## Root Cause

`package.json`'s `lint` and `standard` scripts passed unquoted globs — `src/**/*.js test/**/*.js` — as arguments to the npm script, which npm executes via `/bin/sh` (dash on Debian/Ubuntu-based Linux, not bash). Dash has no `globstar` shell option at all, and even bash's `globstar` is off by default, so `**` degrades to behaving exactly like a single `*`. The shell — not `standard`'s own bundled glob engine — expanded the pattern first, silently turning "any depth under `src/`/`test/`" into "exactly one directory level deep." Every file sitting directly in `src/` or `test/` (`src/index.js`, `test/ad.js`, `test/core.js`, `test/algorithms.js`, ...) never matched and was never passed to `standard` — with zero signal that anything was wrong, because a glob that matches fewer files than intended produces no error, just quiet under-coverage.

## Fix

Quoted both globs in `package.json` (`'src/**/*.js' 'test/**/*.js'`), so the shell passes the literal pattern string through unexpanded and `standard`'s own glob engine — which does implement `**`/globstar correctly — performs the expansion. This is a strict superset of what the broken pattern matched (every previously-linted file is still matched, plus the previously-skipped top-level ones); it does not accidentally sweep in unrelated files, since the pattern is still scoped to `src/**`/`test/**` and can't reach `dist/` build output or root config files.

Fixing the scope surfaced several previously-hidden, genuinely-live violations, all fixed in the same pass: the over-precision literal in `test/ad.js`, two similar over-precision reference literals in `test/dist-cases-continuous.js`, and two `no-new` violations in `test/process.js` (constructor calls used only for their side effect, now captured and asserted with `instanceof`).

## Prevention Strategy

Any npm script (or other shell-invoked CLI argument) using `**` must be single-quoted so the pattern reaches the target tool's own glob engine instead of being pre-expanded by the invoking shell — this project's `jsdoclint` script was already doing this correctly (`'src/dist/[!_]*.js'`, etc.) and can serve as the local reference pattern for how to write these scripts. More generally: a glob-based check that silently matches *fewer* files than intended produces no error signal at all — periodically verify tool file-selection scripts (lint, coverage, doc generation) actually cover files at every expected directory depth, e.g. by deliberately introducing a violation in a top-level file and confirming the script catches it, the way this bug was actually discovered (an isolated single-file `standard` invocation disagreeing with the full-repo script).

## Related Solutions

- `solutions/tooling/2026-07-15-1230-jsdoclint-src-mc-coverage-gap.md` — a different root cause (the `jsdoclint` script's glob simply omitted `src/mc/**` entirely) but the same category of failure mode: an npm script's file-selection glob silently under-covering the codebase with no error signal. Together these suggest glob-based tool configuration in this repo's `package.json` deserves periodic, deliberate coverage verification rather than being trusted once written.

## Key Insight

An unquoted `**` in an npm script argument is silently truncated to a single `*` by POSIX `/bin/sh` (no globstar support, and bash's own globstar is off by default too), so top-level files in the globbed directories are permanently skipped by the linter with zero indication anything is wrong — always quote glob arguments in `package.json` scripts, and don't trust a clean `npm run standard` without occasionally verifying it actually reaches every directory depth it claims to.
