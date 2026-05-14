---
date: 2026-05-14T14:00:00Z
category: "tooling"
problem: "npm test crashed on Node 20+ with ERR_MODULE_NOT_FOUND due to unmaintained esm shim"
status: complete
related_issue: "#99"
related_plan: "thoughts/plans/2026-05-14-1230-ci-test-workflow-fix.md"
tags: [ci, mocha, esm, babel, node20, devDependencies, module-loader]
---

# Solution: esm shim replaced with @babel/register for Node 20+ compatibility

**Date**: 2026-05-14
**Category**: tooling
**Related Issue**: #99

## Problem

`npm test` failed on Node 20+ with `ERR_MODULE_NOT_FOUND` on extensionless relative imports (e.g. `import { repeat } from './test-utils'`). CI was completely broken — not because of flaky statistical tests, but because the ES module loader shim used by the `test` script had become incompatible with the Node 20 runtime. The `coverage` script ran without issue, creating a confusing split where coverage passed but plain testing did not.

## Root Cause

The `test` script used the `esm` npm package (v3.2.25, last published in 2019) as a CommonJS-to-ESM shim via `-r esm`. On Node 20+, Node's built-in ESM loader activates and intercepts module resolution before the `esm` shim can handle it. The shim's extensionless import resolution — which was always a non-standard workaround — no longer ran, causing `ERR_MODULE_NOT_FOUND` for every `import` statement that omitted the `.js` extension.

The `coverage` script was immune because it already used `@babel/register`, which transpiles `import`/`export` to CommonJS `require()` calls before execution; CJS `require()` resolves extensionless paths natively.

## Fix

Replaced `-r esm` with `--require @babel/register` in the `test` script (`package.json:29`), then removed the `esm` devDependency entirely. The Babel stack (`@babel/core`, `@babel/preset-env`, `@babel/register`) was already present and fully configured. This unified the test and coverage execution paths.

## Prevention Strategy

When two npm scripts (e.g. `test` and `coverage`) invoke the same test suite, they must use the same module loader/transpiler. Divergent loader choices are a latent fragility: if one path relies on an unmaintained shim, it will break silently as the Node runtime evolves while the other path masks the failure. Codify the canonical loader in one place so both scripts inherit it rather than duplicating it as separate flags. Flag any devDependency whose last publish date is more than 2 years old during dependency audits.

## Related Solutions

No prior solutions found in this repo.

## Key Insight

The `esm` shim (last published 2019) silently broke on Node 20+ because native ESM supersedes it — if a project's `test` and `coverage` scripts use different module loaders, the working one masks the broken one until CI is run without coverage.
