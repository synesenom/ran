---
date: 2026-05-30T14:00:00Z
category: "distribution"
problem: "Bates.fit() returns wrong integer n because Nelder-Mead stalls on staircase likelihood surface"
status: complete
related_issue: "#481"
related_plan: "thoughts/plans/2026-05-30-1400-bates-fit-profile-likelihood.md"
tags: [fit, nelder-mead, integer-parameter, profile-likelihood, grid-search, bates, MLE]
---

# Solution: Bates.fit() integer n recovery via profile likelihood grid search

**Date**: 2026-05-30
**Category**: distribution
**Related Issue**: #481

## Problem

`Bates.fit(data)` inherited the base-class 3-parameter Nelder-Mead and routinely returned the
wrong integer `n`. The existing test acknowledged the failure by permitting `n ∈ [2, 4]` (±1
tolerance) for a planted `n = 3`. Under typical sample sizes, the returned `n` could be off by
1 and the `(a, b)` estimates were correspondingly biased because the optimizer had stalled on
the wrong step.

## Root Cause

The Bates constructor calls `Math.round(n)` before any computation. This makes the
log-likelihood a piecewise-constant staircase function of `n`: the likelihood is strictly
identical for all continuous `n` values in `[k − 0.5, k + 0.5)`. Nelder-Mead is designed for
smooth, continuous surfaces. When it perturbs `n` slightly during a reflection or expansion
step, the objective does not change — there is no gradient signal to follow across the integer
boundary. The simplex stalls at whichever plateau it lands on first, which may not contain the
true `n`. Feeding all three parameters jointly into Nelder-Mead is the wrong tool for a mixed
continuous/integer parameter space.

## Fix

A custom `static fit` override was added to `Bates` implementing a **profile likelihood grid
search** (`src/dist/bates.js:80–115`):

1. Use `_fitInit`'s moment estimate `n_hat` to centre an integer search window
   `[max(1, n_hat − 10), n_hat + 10]` (≤21 candidates).
2. For each candidate integer `n`, run 2-parameter Nelder-Mead over `(a, b)` only at fixed `n`,
   using data-derived `(a0, b0)` from `_fitInit` as the starting point (`maxIter: 200`).
3. Return the `(n, a, b)` triple achieving the highest profile log-likelihood.

The test was tightened from `n ∈ [2, 4]` to exact integer recovery (`assert.strictEqual`),
with a five-case parametric test covering n = 1, 2, 3, 4, 5 with N=200 and
`|a_fitted − a_true| < 0.1`, `|b_fitted − b_true| < 0.1`.

## Prevention Strategy

When any distribution parameter is integer-valued and the constructor enforces integrality via
`Math.round` or truncation, **do not include that parameter in the Nelder-Mead simplex**. The
optimization surface is a staircase in that dimension; Nelder-Mead produces no useful signal
across integer boundaries.

The correct pattern is **profile likelihood grid search**:
- Centre the search window on the moment-of-moments estimate from `_fitInit`.
- Use ±10 as the half-width — sufficient for all practically identifiable cases (≤21 inner
  optimizations).
- Run Nelder-Mead over the remaining continuous parameters at each fixed integer.
- Select the integer with the highest profile log-likelihood.
- Use `maxIter: 200` for inner 2D Nelder-Mead calls (2D converges far faster than 3D default
  of 1000).

Apply this pattern whenever a distribution has a count-type parameter (`n`, `k`, degrees of
freedom as integer) and `static fit` is not already overridden.

Note: This pattern is only reliable when `n` is identifiable. For large `n` (e.g. n ≥ 8 for
Bates), the distribution converges to Gaussian and `n` becomes weakly identified — the MLE
may not recover the planted value even with large samples. Limit test cases to the identifiable
range (n = 1–5 for Bates with N=200).

## Related Solutions

- [`solutions/correctness/2026-05-28-1851-reparametrizing-subclass-inherits-wrong-fitinit.md`](../correctness/2026-05-28-1851-reparametrizing-subclass-inherits-wrong-fitinit.md) — subclass _fitInit inheritance issues in MLE fitting
- [`solutions/distribution/2026-05-28-1120-log-series-fitinit-asymptotic-inversion.md`](2026-05-28-1120-log-series-fitinit-asymptotic-inversion.md) — wrong asymptotic inversion in _fitInit seeding Nelder-Mead

## Key Insight

When a distribution parameter is integer-valued and the constructor enforces it via
`Math.round`, Nelder-Mead stalls on the staircase likelihood surface and silently returns the
wrong integer; use profile likelihood grid search instead — enumerate integer candidates,
run Nelder-Mead over the remaining continuous parameters at each fixed integer, and select
the integer with the highest profile log-likelihood.
