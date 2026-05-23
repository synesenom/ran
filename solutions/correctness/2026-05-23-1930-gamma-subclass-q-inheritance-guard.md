---
date: 2026-05-23T19:30:00Z
category: "correctness"
problem: "Gamma._q silently inherited by CDF-transforming subclasses, returning wrong quantiles"
status: complete
related_issue: "#367"
related_plan: "thoughts/plans/2026-05-23-1830-gamma-quantile-dedicated.md"
tags: [gamma, quantile, inheritance, prototype, _q, halley, wilson-hilferty, gammaLowerIncompleteInv]
---

# Solution: Gamma Subclass _q Inheritance Guard

**Date**: 2026-05-23T19:30:00Z
**Category**: correctness
**Related Issue**: #367

## Problem

Adding a dedicated `_q(p)` to `Gamma` caused five subclasses whose CDFs are
transforms of the Gamma variate — `LogGamma`, `MaxwellBoltzmann`,
`GeneralizedGamma`, `DoubleGamma`, and `Chi` — to silently inherit the wrong
quantile and return mathematically incorrect values. The bug was latent before
the optimisation because every distribution fell back to the generic Brent path
(`_qEstimateRoot`).

## Root Cause

JavaScript prototype inheritance automatically propagates any prototype method
to all subclasses. Subclasses that override `_cdf` without overriding `_q`
inherit the parent's inverse — which inverts the wrong CDF. The plan for issue
#367 identified four direct Gamma subclasses needing guards (LogGamma,
MaxwellBoltzmann, GeneralizedGamma, DoubleGamma) but missed `Chi`, an indirect
descendant (Chi → Chi2 → Gamma). The gap was only caught by test failures
during implementation.

## Fix

Set `this._q = undefined` in the constructor of every subclass whose `_cdf`
differs from Gamma's. An own-property `undefined` shadows the prototype method;
`typeof this._q === 'function'` returns `false`, and the `Distribution` base
class falls back to `_qEstimateRoot` (Brent). No changes to the base class or
the generic fallback path were needed.

```javascript
// In each affected subclass constructor, after super():
this._q = undefined  // Gamma._q is wrong for the <transform> transform; fall back to _qEstimateRoot
```

`InverseGamma` received its own correct `_q` override instead of a guard,
calling `gammaLowerIncompleteInv` directly (not via `super._q()`) to stay below
the V8 IC megamorphic threshold — see
`solutions/performance/2026-05-23-1810-super-q-v8-megamorphic-deoptimization.md`.

## Prevention Strategy

When adding a dedicated `_q` to any distribution base class, audit the full
subclass tree — including multi-level chains — for subclasses that override
`_cdf` without overriding `_q`. Set `this._q = undefined` in every such
subclass constructor. The test suite's quantile round-trip check
(`Tests.quantileRoundtrip`) is the reliable safety net: ensure a `quantileVals`
entry exists in `test/dist-cases-continuous.js` for every subclass before
adding a base-class `_q`.

## Related Solutions

- `solutions/performance/2026-05-23-1810-super-q-v8-megamorphic-deoptimization.md`
  — Why InverseGamma cannot use `super._q()`: 7 Gamma subclasses exceed V8's
  inline-cache polymorphism limit, causing a 56× deoptimisation.
- `solutions/correctness/2026-05-18-1133-inverse-chi2-cdf-complementary-gamma.md`
  — InverseChi2 CDF double-cancellation pattern; same caution applied to
  InverseGamma's quantile (invert `1-p` via the lower function).

## Key Insight

`this._q = undefined` in a subclass constructor is the correct pattern to opt
an indirect or direct Gamma descendant out of an inherited quantile shortcut —
it shadows the prototype method at instance level — but the guard must cover the
entire subclass tree, not just direct children.
