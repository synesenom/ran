---
date: 2026-07-16T16:02:00Z
category: "correctness"
problem: "HMC's constructor was missed by an earlier manual sweep that added JSDoc @param blocks to its RWM/AdaptiveMetropolis/Gibbs siblings"
status: complete
related_issue: "#828"
related_plan: "thoughts/plans/2026-07-16-1530-mala-sampler.md"
tags: [mcmc, hmc, jsdoc, typescript-declarations, sibling-sweep, template-reuse]
---

# Solution: a manual convention sweep across sibling files has no mechanical completeness check

**Date**: 2026-07-16
**Category**: correctness
**Related Issue**: #828

## Problem

`src/mc/hmc.js`'s constructor had no JSDoc block with `@param` tags directly above `constructor (logDensity, gradLogDensity, config = {}, initialState = {})` — only the class-level JSDoc above `export default class HMC extends MCMC {`. Because `tsc` only reads `@param` tags from a JSDoc block placed directly on the `constructor()` method (per `CLAUDE.md`'s TypeScript Declarations section), the generated `dist/mc/hmc.d.ts` typed all four constructor parameters as `any`/`{}` instead of `Function`/`Object`, silently degrading the generated type declaration for one sampler out of five in `ran.mc`.

## Root Cause

An earlier PR (#944, "Constructor JSDoc added to MCMC samplers for typed tsc params") applied this exact convention across the `mc` namespace via a manual sweep of sibling classes — but only touched `RWM`, `AdaptiveMetropolis`, and `Gibbs`, missing `HMC`. No mechanical check catches this class of gap: `npm run jsdoclint` validates JSDoc tag *correctness* (are the tags that exist well-formed?), not tag *presence* (does every constructor that should have this block actually have it?). A convention rolled out by hand across N structurally identical siblings has zero automated signal when it's applied to only N-1 of them — everything still lints clean, builds clean, and typechecks clean; the only symptom is a `.d.ts` that's silently worse for the one file that was skipped.

This is the same failure shape as `solutions/correctness/2026-07-13-1624-mcmc-arwindow-sibling-bound-gap.md` (an allocation-guard bound applied to one field of several structurally parallel sibling fields, never propagated to the rest) — a rule enforced by discipline across parallel copies, rather than by a single shared code path, is exactly the kind of rule that silently regresses one sibling at a time.

## Fix

Discovered during this session's mandatory bug-triage stage (`CLAUDE.md`'s "Mandatory bug triage on every fix/hotfix/build" rule, run via the `ops-triage` agent), specifically because `MALA` (`src/mc/mala.js`) was implemented by modeling its constructor directly on `HMC`'s — the act of adding the now-required constructor JSDoc block to the *new* file made `HMC`'s own absence of that block obvious by direct side-by-side comparison against the file it was copied from.

Fixed inline as a small, unrelated, pre-existing-gap commit, kept separate from the MALA feature commit:

```js
export default class HMC extends MCMC {
  /**
   * @param {Function} logDensity The logarithm of the (unnormalized) target density.
   * @param {Function} gradLogDensity The gradient of logDensity: maps a state (number[]) to its
   * gradient (number[]) of the same dimension.
   * @param {Object=} config HMC configuration (see MCMC base class for shared options), plus
   * `stepSize` (ε, the leapfrog step size, default 0.1) and `pathLength` (L, the number of leapfrog
   * steps per iteration, default 10).
   * @param {Object=} initialState Initial state of the sampler (see MCMC base class).
   */
  constructor (logDensity, gradLogDensity, config = {}, initialState = {}) {
```

Verified by regenerating declarations (`npm run build && npm run typecheck`): `dist/mc/hmc.d.ts`'s constructor signature changed from `(logDensity: any, gradLogDensity: any, config?: {}, initialState?: {})` to `(logDensity: Function, gradLogDensity: Function, config?: any | undefined, initialState?: any | undefined)`. No behavior change — JSDoc-only diff.

## Prevention Strategy

When a new class is built via "template reuse" against an existing sibling (a very common pattern in this codebase — see `CLAUDE.md`'s "Adding a New Distribution" and the `mc` module's HMC/RWM/MALA lineage), the act of applying a required convention to the new file is a **free opportunity** to audit whether the template itself already satisfies that same convention. Side-by-side-diff the new file's required elements (JSDoc blocks, validator bounds, structural sections, method ordering) against the file it was copied from, rather than assuming the template is already fully compliant just because it shipped and passed review at the time.

More generally: a convention applied via a manual sweep across sibling files, with no lint rule checking *presence* (only tools checking *correctness* of what's already there), has no mechanical completeness signal by construction. The cheapest moment to discover a missed sibling is exactly when someone next copies one of them as a template — that comparison is often the *first* moment such a gap becomes visible at all.

## Related Solutions

- `solutions/correctness/2026-07-13-1624-mcmc-arwindow-sibling-bound-gap.md` — the same "manual sweep across structurally parallel siblings misses one" failure shape, for a validation bound instead of a JSDoc block.
- `solutions/tooling/2026-07-15-1230-jsdoclint-src-mc-coverage-gap.md` — a different `src/mc` JSDoc-tooling gap (linter *coverage*, not convention *completeness*), worth cross-referencing for anyone searching JSDoc-related `mc` module history.

## Key Insight

A convention applied via a manual sweep across sibling files — enforced by discipline across parallel copies rather than a single shared code path, and checked by a linter for *correctness* but not *presence* — has no mechanical completeness signal; the next PR that copies one sibling as a template should side-by-side-diff required elements against it, since that comparison is often the first moment such a gap becomes visible.
