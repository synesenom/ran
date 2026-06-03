---
date: 2026-06-03T11:30:00Z
category: "distribution"
problem: "Nine integer-parameter distributions returned round(moment) as the MLE instead of the true maximum-likelihood integer"
status: complete
related_issue: "#624"
related_plan: "thoughts/plans/2026-06-03-0910-integer-param-fit-profile-likelihood.md"
tags: [fit, integer-parameter, profile-likelihood, grid-search, MLE, powell, staircase]
---

# Solution: Integer-Parameter fit() Profile Likelihood Grid Search

**Date**: 2026-06-03T11:30:00Z
**Category**: distribution
**Related Issue**: #624

## Problem

`Chi2`, `Chi`, `InverseChi2`, `IrwinHall`, `UniformProduct`, `HeadsMinusTails`, `Soliton`, `Erlang`, and `F` all returned the moment-estimate seed as the MLE integer parameter. The fitted integer never moved from `Math.round(sampleMoment)`. Tests used loose tolerances (`<= 1`) that concealed the failure.

## Root Cause

Every affected constructor calls `Math.round()` on integer parameters before any computation. This makes the log-likelihood a **piecewise-constant staircase** in those dimensions: for any continuous perturbation `n + δ` with `|δ| < 0.5`, the constructor silently produces the same `n`, so the objective value does not change. Powell's line-search and Nelder-Mead see zero gradient across every integer boundary and stall immediately at the seed. The optimizer cannot discover that a neighbouring integer yields a higher likelihood.

The failure is silent: the base-class `fit()` returns a valid distribution, and tests that only assert `result.p.k >= 1` pass even when the true MLE would be k=3 but the returned value is k=4.

For the F distribution specifically, 2D coordinate descent has an additional failure mode: the true optimum may lie off-diagonal (e.g., at (5,11) when the seed is (4,14)), and coordinate descent can get stuck in a ridge that never reaches the off-diagonal cell.

## Fix

Three structural variants, each overriding `static fit()`:

**1. Single integer, no continuous params** (`Chi2`, `Chi`, `InverseChi2`, `IrwinHall`, `UniformProduct`, `HeadsMinusTails`, `Soliton`):
```js
static fit (data) {
  const Cls = this
  const [kHat] = Cls._fitInit(data)
  const kSeed = Math.round(kHat)
  const kLo = Math.max(lowerBound, kSeed - 5)
  const kHi = kSeed + 5
  let bestK = kSeed
  let bestLnL = -Infinity
  for (let k = kLo; k <= kHi; k++) {
    try {
      const lnL = new Cls(k).lnL(data)
      if (lnL > bestLnL) { bestLnL = lnL; bestK = k }
    } catch (_) {}
  }
  return new Cls(bestK)
}
```

**2. Single integer + one continuous param** (`Erlang`): outer integer grid over `k`, inner 1D Powell over `lambda` at each fixed `k`, warm-starting `lambda` from the previous `k`'s converged result to reduce Powell iterations.

**3. Two integers, no continuous params** (`F`): flat 11×11 grid over all `(d1, d2)` pairs, pure `lnL` evaluation. `FisherZ` inherits automatically because the override uses `const Cls = this` — this resolves to `FisherZ` at call time, and `FisherZ._fitInit` already back-transforms data before the grid runs.

## Prevention Strategy

Before adding a distribution parameter to `fit()` or the base-class Powell simplex, check whether the constructor enforces integrality via `Math.round` or truncation. If it does, that parameter **must not** enter the continuous optimizer — passing it in produces a silent zero-gradient failure where the optimizer returns the seed unchanged.

Override `static fit()` and enumerate the integer candidates in a ±5 window around the moment-estimate seed. Use Powell only for any remaining continuous parameters (fixed at each integer point). Apply the correct structural variant:

- Single integer only → pure enumeration (11 evaluations)
- Integer + continuous → outer grid + inner Powell with warm-start
- Two integers → flat 2D grid (121 evaluations)

The Bates reference pattern in `solutions/distribution/2026-05-30-1400-bates-fit-profile-likelihood.md` established this approach; #624 rolls it out to all remaining integer-parameter distributions.

## Related Solutions

- [`solutions/distribution/2026-05-30-1400-bates-fit-profile-likelihood.md`](../distribution/2026-05-30-1400-bates-fit-profile-likelihood.md) — Bates.fit() established the profile likelihood grid search pattern (the reference implementation)
- [`solutions/correctness/2026-05-28-1851-reparametrizing-subclass-inherits-wrong-fitinit.md`](../correctness/2026-05-28-1851-reparametrizing-subclass-inherits-wrong-fitinit.md) — FisherZ subclass inheritance of F._fitInit

## Key Insight

Any distribution parameter enforced as an integer via `Math.round` in the constructor produces a zero-gradient staircase in the likelihood surface that silently strands Powell/Nelder-Mead at the moment-estimate seed — replace the continuous optimizer for that dimension with a ±5 integer grid search, running Powell only over any remaining continuous parameters at each fixed integer.
