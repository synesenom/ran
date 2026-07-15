---
date: 2026-07-15T12:30:00Z
category: "tooling"
problem: "jsdoclint's glob never included src/mc at all, so RWM/Gibbs shipped with unchecked JSDoc; extending the glob for HMC surfaced a latent ecmaVersion incompatibility with gibbs.js's pre-existing object-spread syntax"
status: complete
related_issue: "#824"
related_plan: "thoughts/plans/2026-07-15-0955-hmc-sampler.md"
tags: [jsdoclint, eslint, ecmaVersion, tooling-gap, mc, coverage-glob]
---

# Solution: jsdoclint Never Covered src/mc, Hiding a Parser Incompatibility

**Date**: 2026-07-15T12:30:00Z
**Category**: tooling
**Related Issue**: #824

## Problem

While adding `HMC` (a new `MCMC` subclass, issue #824), bug triage found that
`package.json`'s `jsdoclint` script glob (`src/dist/... src/core/... src/location
src/dispersion src/shape src/dependence src/test src/process/...`) omitted
`src/mc/**` entirely. `RWM`, `Gibbs`, and the `MCMC` base class had all shipped
with their JSDoc never checked by the JSDoc-specific linter — only by
`standard` (which validates formatting, not JSDoc tag/type correctness).

Extending the glob to include `src/mc/_mcmc.js 'src/mc/[!_]*.js'` (so the new
`hmc.js` would actually be linted) immediately failed with a parse error in
the already-existing `gibbs.js`:

```
/home/user/ran/src/mc/gibbs.js
  37:19  error  Parsing error: Unexpected token ..
```

## Root Cause

`gibbs.js:37` uses object-spread syntax (`{ ...config, dim: conditionals.length
}`), an ES2018 feature. `.eslintrc.jsdoc.js`'s `parserOptions.ecmaVersion` was
pinned at `2017` (per that file's own comment, to avoid an unrelated
`eslint-plugin-jsdoc` schema incompatibility — see
`solutions/tooling/2026-05-18-1000-eslint-plugin-jsdoc-esm7-schema-incompatibility.md`).
Since `jsdoclint` had never been pointed at `src/mc` since `gibbs.js` was
written, this parser/syntax mismatch had zero opportunity to surface — the
file passed `standard` (a separate, ES2018-aware toolchain) and every test
run, but the JSDoc-specific linter simply never touched it.

This is a directory-scoped coverage gap, not a regression: the `jsdoclint`
glob was accurate for the directories it was written against, but nothing
re-audited it when `src/mc` was added as a new namespace. A glob gap of this
kind is invisible by construction — there is no failing check to point at it,
only an absence of a check.

## Fix

1. Extended `package.json`'s `jsdoclint` script to include
   `src/mc/_mcmc.js 'src/mc/[!_]*.js'`, mirroring the existing
   `src/process/_process.js 'src/process/[!_]*.js'` pattern already used for
   that namespace.
2. Bumped `.eslintrc.jsdoc.js`'s `parserOptions.ecmaVersion` from `2017` to
   `2018` so the parser accepts `gibbs.js`'s object-spread. Verified this is
   safe by confirming no other file already covered by the glob
   (`src/dist`, `src/core/index.js`, `src/location`, `src/dispersion`,
   `src/shape`, `src/dependence`, `src/test`, `src/process`) uses any ES2018-
   only syntax that this bump could newly reject (bumping `ecmaVersion` only
   widens accepted grammar; it cannot un-parse code that was previously
   valid).
3. `npm run jsdoclint` now passes cleanly across the entire `src/mc`
   namespace (`RWM`, `Gibbs`, `HMC`, `MCMC`) with zero new violations.

## Prevention Strategy

When adding a new file to a directory that an existing lint/test/coverage
glob does not yet include, check whether the *directory itself* is covered at
all before assuming the new file merely needs to pass whatever checks already
run. A scoped glob that was correct when written can silently exclude an
entire namespace added later, and — unlike a failing lint rule — there is no
alert when a directory is simply never linted. Treat "is this directory
covered by every relevant lint/tooling script" as an explicit item to check
when a module's first file is added to a new directory, not something to
discover only when someone finally widens the glob.

## Related Solutions

- [`solutions/tooling/2026-05-18-1000-eslint-plugin-jsdoc-esm7-schema-incompatibility.md`](2026-05-18-1000-eslint-plugin-jsdoc-esm7-schema-incompatibility.md) — the prior `.eslintrc.jsdoc.js` version-pinning decision this fix builds on (the `eslint-plugin-jsdoc` version pin is unrelated to and unaffected by this `ecmaVersion` bump).
- [`solutions/correctness/2026-07-15-1230-hmc-resumed-internal-state-validation-gap.md`](../correctness/2026-07-15-1230-hmc-resumed-internal-state-validation-gap.md) — a second, unrelated-in-mechanism but same-shaped gap found in the same PR: a dormant hole in shared `src/mc` infrastructure that only became visible when a new addition (`HMC`) was the first to exercise the code path it covers.

## Key Insight

A lint glob scoped by directory can have a namespace-shaped hole that stays invisible until the first new file in that namespace is added and the glob is finally widened to include it — audit directory coverage explicitly when a module gains its first file in an existing directory, rather than trusting "it's passed CI so far" as evidence the directory was ever actually checked.
