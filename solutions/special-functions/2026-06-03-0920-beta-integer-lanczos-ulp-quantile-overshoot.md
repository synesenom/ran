---
date: 2026-06-03T09:20:00Z
category: "special-functions"
problem: "beta(1,4) returns 0.67 ULPs above 0.25 via logGamma round-trip, causing YuleSimon(3).q(0.75)=2 instead of 1"
status: complete
related_issue: "#653"
related_plan: "thoughts/plans/2026-06-03-0910-fix-yule-simon-quantile-overshoot.md"
tags: [beta, logGamma, Lanczos, ULP, floating-point, quantile, discrete, integer-arguments, exact-path, yule-simon]
---

# Solution: Beta integer-argument Lanczos ULP error cascades to discrete quantile overshoot

**Date**: 2026-06-03T09:20:00Z
**Category**: special-functions
**Related Issue**: #653

## Problem

`new ran.dist.YuleSimon(3).q(0.75)` returned `2` instead of the mathematically correct `1`. For YuleSimon(3), CDF(1) = 3·B(1,4) = 3/4 = 0.75 exactly, so the discrete quantile at p=0.75 must be 1. The test fixture had the wrong value (`x: 2`) because it was originally generated from the buggy library output rather than an independent source.

## Root Cause

`beta(x, y)` was implemented as `Math.exp(logGamma(x) + logGamma(y) - logGamma(x + y))` — three Lanczos series evaluations whose accumulated error shifted `beta(1,4)` to `0.25000000000000017` (≈0.67 ULPs above the exact `0.25`). Subtracting from 1 in `YuleSimon._cdf` flipped the error direction:

```
1 - 0.25000000000000017 = 0.7499999999999998  (should be 0.75)
```

The `_qEstimateTable` upper-bound search uses a strict `>=` comparison:

```js
if (this.cdf(k2) >= p) { break }
```

Since `0.7499999999999998 < 0.75`, the loop advanced past k=1 to k=3, establishing bracket [1, 3]. The binary search then returned k=2 (since `cdf(2) = 0.9 >= 0.75`).

The full call chain:
```
q(0.75) → _qEstimateTable(0.75) → cdf(1) → _cdf(1)
  → beta(1, 4) = exp(logGamma(1)+logGamma(4)-logGamma(5))
  = 0.25000000000000017  ← 0.67 ULPs high
  → _cdf(1) = 1 - 0.25000000000000017 = 0.7499999999999998  ← below 0.75
  → _qEstimateTable skips k=1, returns 2
```

## Fix

Added an integer-argument fast path at the top of `src/special/beta.js`. For positive integer arguments with `min(x,y) <= 30`, compute via the recurrence:

```
B(1, n) = 1/n
B(m, n) = B(m-1, n) * (m-1) / (m+n-1)
```

Each step multiplies by a ratio of small integers (≤ 60 for m≤30, n≥1), well within the 53-bit IEEE 754 mantissa. For the key case `B(1,4)`, the fast path returns exactly `1/4 = 0.25` (zero rounding error), making `_cdf(1) = 0.75` and `q(0.75) = 1` correct. Arguments with `min(x,y) > 30` or any non-integer fall through to the original logGamma path unchanged.

The `min(x,y) <= 30` cap follows the established codebase pattern of argument-class fast paths in `logGamma` (guards for `z <= 0` and `z < 0.5`) and `gamma`. The test reference value for YuleSimon(3) at p=0.75 was corrected from `x:2` to `x:1` as a consequence.

## Prevention Strategy

1. **Integer-argument fast path rule for special functions wrapping transcendental series**: When a function computes `f(m, n)` for positive integer arguments and the result is a simple rational (e.g., `1/n`, `(m-1)!/(m+n-1)!`), add a fast path using the cheapest exact recurrence before invoking the series. This is especially important when the result is exactly representable in IEEE 754 (1/4, 1/2, 1/8, ...) and downstream code uses strict comparisons.

2. **Never generate test fixtures from the library's own output**: `quantileVals` entries must be verified against an independent source (scipy, mpmath, hand calculation). A fixture generated from buggy output codifies the bug and suppresses future fixes. The comment `// scipy.stats.yulesimon(alpha=3)` above the `refVals` block was correct; the `quantileVals` block lacked an equivalent verification.

3. **Precision cascade audit for discrete quantile bugs**: When a discrete quantile returns n+1 instead of n at a "round" probability (one that should exactly equal a CDF step), first check whether the CDF at that step is within 1–2 ULPs of the target probability. The cause is almost always a sub-ULP error in a special function upstream, not a bug in `_qEstimateTable` itself. Fix the source.

4. **Don't patch `_qEstimateTable` with fuzzy tolerance**: Adding `p - q <= N * eps * p` to the strict `>=` comparison would mask the symptom but affect all discrete distributions and risks returning n instead of n+1 for distributions where the CDF is genuinely below p. Fix the special function instead.

## Related Solutions

- [`solutions/testing/2026-05-20-0459-discrete-quantile-ceil-minus-one-pattern.md`](../testing/2026-05-20-0459-discrete-quantile-ceil-minus-one-pattern.md) — Discrete quantile off-by-one from floor/ceil in closed-form inverses; the same prevention principle applies: fix the formula, not the quantile search.
- [`solutions/correctness/2026-05-18-1133-inverse-chi2-cdf-complementary-gamma.md`](../correctness/2026-05-18-1133-inverse-chi2-cdf-complementary-gamma.md) — CDF precision loss (double subtraction-from-1) propagating to wrong quantile; same cascade pattern.

## Key Insight

When `beta(m, n)` for small positive integers is routed through three `logGamma` Lanczos evaluations, the accumulated round-trip error can shift an exactly-representable rational result (like 1/4) by a sub-ULP amount that is still enough to break strict `>=` comparisons in discrete quantile search; use the recurrence `B(1,n)=1/n`, `B(m,n)=B(m-1,n)*(m-1)/(m+n-1)` for small integer arguments to return IEEE 754-exact values.
