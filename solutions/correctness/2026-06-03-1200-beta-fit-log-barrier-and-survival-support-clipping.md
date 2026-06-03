---
date: 2026-06-03T12:00:00Z
category: "correctness"
problem: "Beta-family fit() converges to near-singular shape params; survival()/hazard() return wrong values outside support"
status: complete
related_issue: "#625"
related_plan: "thoughts/plans/2026-06-03-1010-beta-fit-penalty.md"
tags: [beta, fit, mle, map, powell, log-barrier, jeffreys, penalty, singularity, survival, hazard, support-clipping]
---

# Solution: Beta-family fit() log-barrier and survival/hazard support-clipping fix

**Date**: 2026-06-03
**Category**: correctness
**Related Issue**: #625

## Problem

Two independent bugs in `Distribution`'s base-class methods.

**Bug 1 (primary, #625):** `fit()` on Beta-family distributions (`Beta`, `BetaRectangular`, `BetaPrime`)
converged to near-zero shape parameters (e.g. alpha ≈ 0.001) instead of the interior MLE. The
existing `isFinite` guard in the Powell optimizer objective only rejected exact singularities where
lnL is non-finite; for near-boundary parameters, lnL is large-but-finite, so the optimizer treated
those as valid deep minima.

**Bug 2 (secondary):** `survival(x)` and `hazard(x)` returned wrong values outside a distribution's
support. For example, `Pareto(1,2).survival(0.5)` returned 4 instead of 1.

## Root Cause

**Bug 1:** The Powell optimizer sees the negative-log-likelihood surface, which for Beta-type
distributions has a spurious near-singular "trough" as alpha or beta approaches zero. Without a
penalty that grows without bound as the parameter approaches zero, a strong optimizer (Powell's
method, unlike the weaker Nelder-Mead it replaced in #546) reliably finds and sits in that trough.
The `isFinite` guard from ADR-0016 blocked the exact singularity but not the neighborhood.

**Bug 2:** `survival()` called `this._cdf(x)` and `hazard()` called `this._pdf(x)` — the raw
private implementations that have no support-boundary clamping. Only the public `cdf(x)` and
`pdf(x)` wrappers enforce clamping. Calling private methods directly let `_cdf(0.5)` on a Pareto
with support `[1, ∞)` compute a nonsensical negative CDF value, producing survival > 1.

## Fix

**Bug 1:** Added a `static _fitPenalty(dist)` hook to `Distribution` (default: `return 0`, no
effect on any existing distribution). The `fit()` objective constructs the candidate instance once
and adds the penalty:

```javascript
const inst = new Cls(...params)
const v = -inst.lnL(data) + Cls._fitPenalty(inst)
```

`Beta` overrides the hook with a Jeffreys-like log-barrier:

```javascript
static _fitPenalty (dist) {
  return -0.5 * (Math.log(dist.p.alpha) + Math.log(dist.p.beta))
}
```

The hook receives the already-constructed instance (not the raw params vector) so it reads
`dist.p.alpha` / `dist.p.beta` — safe regardless of subclass constructor arity. Notably, `R`
has one constructor param `c` (with `super(c/2, c/2)`), so `params[1]` would be `undefined`.
All Beta subclasses call `super(alpha, beta)` which stores `this.p.alpha` and `this.p.beta`,
making the override inheritance-safe. ADR-0017 documents the shift from pure MLE to MAP for
Beta-family.

**Bug 2:** Changed `survival()` from `1 - this._cdf(x)` to `1 - this.cdf(x)` and `hazard()`
from `this._pdf(x) / this.survival(x)` to `this.pdf(x) / this.survival(x)`.

## Prevention Strategy

**For Bug 1:** When upgrading from a weak optimizer (Nelder-Mead) to a strong one (Powell, BFGS),
audit all distributions whose log-likelihood is finite near parameter boundaries but diverges at the
boundary — these are cases where a stronger optimizer finds boundary-adjacent pseudo-optima the
weaker one could not reach. Distributions with shape parameters bounded below by 0 should be reviewed
for `_fitPenalty` overrides at optimizer upgrade time.

**For Bug 2:** In base-class methods, always call public-API methods (`this.pdf()`, `this.cdf()`)
rather than private implementations (`this._pdf()`, `this._cdf()`) unless the intent is explicitly
to bypass support clamping. The private methods are implementation details; public methods carry the
full behavioral contract including boundary handling.

## Related Solutions

- `solutions/correctness/2026-05-28-1851-reparametrizing-subclass-inherits-wrong-fitinit.md` — Beta subclasses inheriting wrong `_fitInit` (same static-hook inheritance pattern)
- `solutions/distribution/2026-05-30-1400-bates-fit-profile-likelihood.md` — Bates fit() optimizer convergence failure (related fit() correctness work)

## Key Insight

When a strong optimizer like Powell replaces a weak one like Nelder-Mead, distributions whose
log-likelihood is finite-but-large near a parameter boundary gain a new failure mode — the optimizer
successfully finds boundary-adjacent pseudo-optima — requiring a penalty that *diverges* at the
boundary (a Jeffreys log-barrier `−0.5·log(α)`) rather than a finite guard.
