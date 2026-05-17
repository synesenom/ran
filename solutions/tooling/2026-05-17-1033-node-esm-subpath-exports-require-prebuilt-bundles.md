---
date: 2026-05-17T10:33:41Z
category: "tooling"
problem: "Source files with bare directory imports cannot be used as package.json subpath export targets for Node.js ESM consumers"
status: complete
related_issue: "#109"
related_plan: "thoughts/plans/2026-05-17-1016-subpath-exports.md"
tags: [rollup, package-exports, node-esm, subpath-exports, directory-imports, esm, bundler]
---

# Solution: Node ESM subpath exports require pre-built bundles when source uses bare directory imports

**Date**: 2026-05-17T10:33:41Z
**Category**: tooling
**Related Issue**: #109

## Problem

Consumers of ranjs who needed only a single distribution (e.g. `Normal`) were forced to import the entire 360 KB monolithic bundle. There were no `"exports"` subpath entries in `package.json`, so `import Normal from 'ranjs/dist/normal'` was not a valid import path in Node.js ESM, browser ESM, or bundlers.

## Root Cause

The obvious fix — pointing `"exports"` subpaths directly at `src/dist/*.js` (Option A) — is blocked by a hard constraint in Node.js v22 ESM resolution: **Node.js forbids bare directory imports and requires explicit file extensions**. All source files use bare directory imports that work through Rollup's `nodeResolve` plugin at build time but fail at runtime:

```
import { erf } from '../special'        // bare directory — ERR_UNSUPPORTED_DIR_IMPORT
import Distribution from './_distribution'  // no .js extension — also fails in strict ESM
```

Verified empirically: `node src/dist/normal.js` fails immediately with `ERR_UNSUPPORTED_DIR_IMPORT`. Fixing this at the source level would require adding `.js` extensions and explicit `index.js` references across all 138 distribution files — a prohibitive cross-cutting change.

## Fix

**Option B**: extend `rollup.config.js` to export an array of configs — the existing monolithic config as the first element, plus one self-contained single-input config per actively-exported distribution:

```js
// Parse actively-exported distributions from src/dist/index.js (non-commented lines only).
// See decisions/0005-per-distribution-subpath-exports.md
const indexSrc = readFileSync('./src/dist/index.js', 'utf8')
const distNames = [...indexSrc.matchAll(/^export.*from '\.\/([a-z0-9][a-z0-9-]*)'$/gm)]
  .map(m => m[1])

const perDist = distNames.map(name => ({
  input: `src/dist/${name}.js`,
  plugins: [nodeResolve()],
  output: { file: `dist/${name}.esm.js`, format: 'es', banner: copyright }
}))

export default [monolithic, ...perDist]
```

Each per-distribution config has a single input — Rollup never code-splits single-input configs — so all transitive dependencies are inlined, producing fully self-contained `dist/<name>.esm.js` files (~40 KB each).

`package.json` received 134 subpath entries (`"./dist/<name>": { "import": "./dist/<name>.esm.js" }`). A sync-check script (`scripts/check-subpath-exports.js`) uses the same regex to validate that both artefacts stay aligned in CI.

The regex is intentionally restrictive (`[a-z0-9][a-z0-9-]*`) to match only valid distribution names and prevent path traversal if `src/dist/index.js` were ever modified with a malicious path.

## Prevention Strategy

1. **Test the source path first**: before committing to an `"exports"` source-subpath strategy, verify with `node src/<file>.js`. If it fails with `ERR_UNSUPPORTED_DIR_IMPORT`, the files must be pre-built.

2. **Source files with bundler-targeted imports need pre-built outputs for Node ESM**: bare specifiers (`'../special'`) and directory imports (`'./_distribution'`) are a sign that the file depends on a bundler's resolver. They cannot be served directly to Node.js ESM consumers.

3. **When build config and package.json share a source of truth, add a sync-check**: whenever two artefacts are both derived from the same source list (here: `src/dist/index.js` → Rollup config + `package.json` exports), colocate the parsing logic and add a CI script that reads both and fails on divergence. Otherwise silent drift accumulates whenever items are added or removed.

4. **Restrict filename regexes to the actual character set**: a regex like `[^_'][^']*` may work today but permits path traversal via `../`. Use the actual distribution naming convention (`[a-z0-9][a-z0-9-]*`) to document intent and prevent footguns.

## Related Solutions

- [`solutions/tooling/2026-05-14-1400-esm-shim-node20-breakage.md`](2026-05-14-1400-esm-shim-node20-breakage.md) — Node 20+ ESM compatibility: replaced `esm` shim with `@babel/register` when Node's strict ESM resolution broke the test suite. Same underlying constraint (Node.js ESM strictness) in a different context.

## Key Insight

Node.js v22 ESM forbids bare directory imports (`ERR_UNSUPPORTED_DIR_IMPORT`), so source files that rely on a bundler's module resolver cannot be used as `"exports"` subpath targets for Node ESM consumers — they must be pre-built into self-contained bundles via Rollup first.
