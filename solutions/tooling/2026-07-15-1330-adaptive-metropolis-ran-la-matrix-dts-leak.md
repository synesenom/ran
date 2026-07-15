---
date: 2026-07-15T13:30:00Z
category: "tooling"
problem: "npm run typecheck fails with 'Cannot find namespace ran' when a publicly-reachable class caches an internal Matrix/Vector instance as a field"
status: complete
related_issue: "#823"
related_plan: "thoughts/plans/2026-07-15-1230-adaptive-metropolis-sampler.md"
tags: [typescript, jsdoc, declaration-generation, tsc, allowJs, matrix, vector, la, public-api-surface]
---

# Solution: `ran.la.Matrix` leaking into a public `.d.ts` as an unresolvable type

**Date**: 2026-07-15
**Category**: tooling
**Related Issue**: #823

## Problem

While implementing `ran.mc.AdaptiveMetropolis` (`src/mc/adaptive-metropolis.js`), `npm run typecheck` failed at the Phase 4 pre-PR verification step with:

```
dist/mc/adaptive-metropolis.d.ts(21,12): error TS2503: Cannot find namespace 'ran'.
```

on a generated field declaration `_epsI: ran.la.Matrix;`. Every earlier gate — `npm run standard`, `npm run jsdoclint`, and `npm test` (Mocha/nyc, which never invokes `tsc`) — passed cleanly. The bug was invisible until the very last verification step, and would have shipped undetected in any workflow that skips `npm run build && npm run typecheck`.

## Root Cause

`tsc --allowJs --declaration` (via `tsconfig.build.json`) infers a JS class field's declared type from the JSDoc `@returns` of whatever expression it's assigned. The constructor originally cached a regularization matrix as an instance field:

```js
this._epsI = new Matrix(this.dim).scale(EPS)
```

`Matrix.scale()` is documented `@returns {ran.la.Matrix}`, because `src/la/matrix.js`'s `Matrix` class carries `@memberof ran.la`. But `ran.la` is **not** part of the public export surface — `src/index.js` only re-exports `core, dependence, dispersion, dist, location, mc, process, shape, test`, never `la`. No ambient `declare namespace ran { namespace la { ... } }` exists anywhere in the checked type graph, so the fully-qualified dotted type reference `ran.la.Matrix` is unresolvable the instant any *publicly reachable* class stores a raw `Matrix`/`Vector` instance as a persistent field.

This exact pattern already existed twice in the codebase before this change — `src/ts/online-covariance.js` (`this.mean`/`this.cov` fields) and `src/utils/distance-matrix.js` (`@returns {ran.la.Matrix}`) — but neither had ever tripped `typecheck`, because neither `ts` nor the relevant `utils` function is re-exported from `src/index.js`. Their broken `.d.ts` declarations sit in `dist/` unreached by `types-test.ts`'s import graph (`types-test.ts` → `ranjs` → `dist/index.d.ts` → ...), so `tsc` never loads them into its program. `AdaptiveMetropolis` was the first `Matrix`-caching class reachable via `mc` — which *is* publicly exported — so it was the first to actually surface the latent defect.

## Fix

Removed the `_epsI` instance field entirely and moved the regularization-matrix construction inline into `_refreshFactor()`, computing it fresh on each call instead of caching it at construction time:

```js
_refreshFactor () {
  const cov = new Matrix(this._covS).scale(this._sd / (this._covN - 1)).add(new Matrix(this.dim).scale(EPS))
  const { D, L } = cov.ldl()
  this._A = L.mult(D.f(Math.sqrt))
}
```

Local variables inside a method body produce no `.d.ts` field declaration — only instance/static fields do — so the unresolvable `ran.la.Matrix` reference disappears from the generated declaration entirely. This was viable here because `_refreshFactor()` already runs at a gated, low frequency (only once `this._covN >= 2 * this.dim`, and even then only during warm-up), so the small `O(dim)` rebuild cost is not a hot-path concern.

## Prevention Strategy

1. **Never store an instance of a class from a non-publicly-exported directory (`src/la/`, `src/algorithms/`, `src/special/`) as a field on a class that is reachable from `src/index.js`'s export graph.** Recompute it locally inside the method that needs it, or extract only the primitive data (plain arrays/numbers) from it rather than the wrapper instance.
2. If caching genuinely is required for performance, either (a) export the containing namespace (e.g. `la`) from `src/index.js` so `ran.la.Matrix` becomes a real, resolvable ambient type, or (b) add an explicit `@type` JSDoc override at the field declaration site naming a type that actually resolves, instead of relying on type inference from the assigned expression's own `@returns`.
3. **`npm run build && npm run typecheck` must remain a mandatory, non-skippable gate** for any PR touching `src/mc/`, `src/ts/`, `src/utils/`, or any other module that imports from `src/la/`, `src/algorithms/`, or `src/special/` and assigns the result to `this.<field>` — `npm test` cannot catch this class of bug, since Mocha never runs `tsc`.
4. When reviewing a diff that adds `this.<field> = new (Matrix|Vector)(...)` inside a constructor, check whether the containing class's module is reachable from `src/index.js`'s export graph; if so, treat it as a build-breaking risk until `npm run typecheck` has actually been run against it, not just assumed safe by analogy with existing (but unreachable, hence untested) code that does the same thing.

## Related Solutions

None found — no prior solution document covers TypeScript declaration generation or the `ran.la`/internal-module boundary.

## Key Insight

`tsc`'s `allowJs` declaration inference types a JS instance field literally from the assigned expression's own JSDoc `@returns` — including fully-qualified dotted names like `ran.la.Matrix` — with no check that the referenced namespace is actually part of the exported/checked type graph, so caching an object from an internal-only directory as a field on any publicly-reachable class silently breaks `npm run typecheck` while `npm test` stays green; two pre-existing identical instances (`src/ts/online-covariance.js`, `src/utils/distance-matrix.js`) remain latent only because their containing modules aren't re-exported from `src/index.js`.
