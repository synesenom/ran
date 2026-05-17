# ADR-0005: Per-Distribution Subpath Exports via Self-Contained Rollup Bundles

**Date**: 2026-05-17
**Status**: Accepted

## Context

Issue #109: consumers who need only one distribution (e.g. `Normal`) are forced to import the entire 360 KB ranjs bundle. The fix is to publish per-distribution subpath exports so that `import Normal from 'ranjs/dist/normal'` works without loading the rest of the library.

Two implementation options were evaluated:

**Option A (source subpaths):** Point `"exports"` subpath entries directly at `src/dist/*.js`. Simpler — no additional build step. However, `src/dist/` files use bare directory imports (`import { erf } from '../special'`) without file extensions. Node.js v22 ESM resolution forbids directory imports and requires explicit extensions. Verified empirically: importing any `src/dist/*.js` file directly in Node.js fails with `ERR_UNSUPPORTED_DIR_IMPORT`. Option A only works with a bundler-based consumer (Vite, Webpack). The issue's acceptance criteria explicitly require Node ESM compatibility.

**Option B (per-file Rollup build):** Build each distribution as a self-contained ESM bundle. Resolves in all environments (Node ESM, browsers, bundlers). Tradeoff: each bundle (~40 KB) duplicates the shared infrastructure (~35 KB base class + algorithms + PRNG). 138 distributions × 40 KB ≈ 5.5 MB additional package output vs the 360 KB monolithic ESM bundle.

For the Rollup build extension, three sub-options were evaluated: (1) inline array of configs in `rollup.config.js`, (2) code-split multi-input config, (3) separate programmatic build script. Code splitting is incompatible with self-contained output. A separate script splits build logic across two locations unnecessarily when Rollup natively supports array-of-configs.

## Decision

Use **Option B** (per-file Rollup builds) with **inline array of configs in `rollup.config.js`**:

1. `rollup.config.js` exports an array. The existing three-output monolithic config is the first element. The remaining elements are one config per actively-exported distribution: `{ input: 'src/dist/<name>.js', plugins: [nodeResolve()], output: { file: 'dist/<name>.esm.js', format: 'es' } }`. Each single-input config never code-splits — Rollup inlines all transitive dependencies, producing fully self-contained output.

2. The list of distributions to build is derived at Rollup config-read time by parsing the non-commented export lines in `src/dist/index.js`. This ensures only distributions actually published via the main index get per-distribution builds (excluded: `Davis`, `BetaGeometric`, `BetaNegativeBinomial`).

3. Subpath exports follow the `"./dist/<name>"` convention (kebab-case, matching the source filename without extension), pointing to `"./dist/<name>.esm.js"` under the `"import"` condition only — no CJS condition for subpaths, keeping the build output tractable.

4. No `"type": "module"` change to `package.json`. The `"import"` condition in `"exports"` is sufficient for Node.js to load the per-distribution files as ESM.

## Consequences

- `import Normal from 'ranjs/dist/normal'` resolves correctly in Node.js ESM, browsers, and bundlers (Vite, Webpack, esbuild).
- Published package size increases by ~5.5 MB (138 bundles × ~40 KB each). This is acceptable for a library targeting bundler consumers where tree-shaking would occur anyway; for Node.js users the per-distribution entry reduces their load from 360 KB to ~40 KB.
- `npm run build` build time increases from ~2 seconds to ~30–60 seconds. CI workflows must account for this.
- Any new public distribution added to `src/dist/index.js` automatically gets a per-distribution build (no manual `rollup.config.js` edits needed).
- Commented-out distributions (`Davis`, `BetaGeometric`, `BetaNegativeBinomial`) are deliberately excluded. When they are uncommented in `src/dist/index.js`, they automatically gain subpath exports.
- CJS condition for subpaths is not provided; CJS consumers must continue importing from the monolithic `dist/ranjs.cjs.js`.
- TypeScript types for individual subpath imports are out of scope (follow-up issue).
