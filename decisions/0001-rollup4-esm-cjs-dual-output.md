# ADR-0001: Rollup 4 Upgrade with Dual ESM/CJS Output

**Date**: 2026-05-15
**Status**: Accepted

## Context

The build system used Rollup 2 (`^2.64.0`) and produced a single minified UMD bundle (`dist/ranjs.min.js`). Modern bundlers (Vite, esbuild, Webpack 5) and Node.js ESM require an `"exports"` field in `package.json` and a built ESM artifact — not a source file — as the `"import"` condition. Without it, subpath resolution breaks and tree-shaking is unreliable.

Rollup 2's plugin ecosystem (`rollup-plugin-terser`, `@rollup/plugin-node-resolve@^13`) is incompatible with Rollup 4. The upgrade had to be atomic: rollup version, plugin versions, and config changes all land together.

## Decision

Upgrade to Rollup `^4.x` and produce three output formats from `src/index.js`:

1. `dist/ranjs.esm.js` — ES module format, **unminified**, for bundlers and Node ESM
2. `dist/ranjs.cjs.js` — CommonJS format, **unminified**, for `require()` consumers
3. `dist/ranjs.min.js` — UMD format, **minified**, for CDN/browser `<script>` tag use

ESM and CJS outputs are deliberately unminified because:
- Bundlers perform their own dead-code elimination and minification; providing unminified ESM maximises tree-shaking across 130+ distribution classes
- CJS consumers load from local disk — file size is irrelevant to load performance
- Minifying named exports risks mangling class/function names that consumers reference by string

The `"exports"` field in `package.json` routes consumers to the correct artifact via `"import"` → ESM and `"require"` → CJS conditions. `"sideEffects": false` enables bundlers to safely drop unused distributions.

Plugin changes:
- `rollup-plugin-terser` (unmaintained, Rollup 2 only) → `@rollup/plugin-terser`
- `@rollup/plugin-node-resolve@^13` → `@rollup/plugin-node-resolve@^16`
- JSON import in `rollup.config.js` replaced with `createRequire` (no new plugin dependency)

## Consequences

- `import { dist } from 'ranjs'` and `const ran = require('ranjs')` both work correctly in Node.js
- Bundlers can tree-shake individual distributions (e.g. import only `Normal`) from the ESM output
- The existing CDN URL for `dist/ranjs.min.js` continues to work unchanged
- `npm run build` produces three files instead of one
- Follow-up issue #109 (subpath exports per distribution) can now proceed
