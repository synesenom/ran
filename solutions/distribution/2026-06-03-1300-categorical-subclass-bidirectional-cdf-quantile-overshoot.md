---
date: 2026-06-03T13:00:00Z
category: "distribution"
problem: "BetaBinomial, Hypergeometric, and NegativeHypergeometric inherit Categorical prefix-sum CDF which falls 1–3 ULPs below exact boundaries, causing q(p) to overshoot by one"
status: complete
related_issue: "#658"
related_plan: "thoughts/plans/2026-06-03-1115-issue-658-categorical-subclass-cdf-bidirectional.md"
tags: [categorical-subclass, cdf, quantile-overshoot, bidirectional-summation, alias-table, floating-point]
---

# Solution: Categorical Subclass Bidirectional CDF — Quantile Overshoot Fix

**Date**: 2026-06-03
**Category**: distribution
**Related Issue**: #658

## Problem

`BetaBinomial(25,2,2).q(0.5)` returned 13 instead of 12. `NegativeHypergeometric(10,5,3).q(0.5)` returned 3 instead of 2. Both are symmetric parameter configurations where the true mathematical CDF equals exactly 0.5 at the midpoint, yet `q(0.5)` advanced past the correct quantile bucket by one.

One instance was silently encoded as a test fixture: `BetaBinomial(25,2,2)` had `{ p: 0.5, x: 13 }` checked in, generated from the buggy library output rather than an independent reference, suppressing the bug in all subsequent test runs.

## Root Cause

`Categorical._cdf` reads from `cdfTable`, a prefix-sum of AliasTable-normalized weights (`_alias-table.js:70`). `AliasTable` divides every raw weight by `total = Σ weights`. When the raw PMF values — each computed via `Math.exp(logBinomial(…) + logBeta(…) - logBeta(…))` — sum to slightly above 1.0 in floating-point, `total > 1`, and every normalized weight is uniformly scaled downward before being stored.

This per-entry rounding occurs before summation. Kahan/Neumaier compensated summation applied afterward cannot recover precision already lost in each individual weight. After accumulating `(n+1)` such slightly-small terms, the prefix sum at an exact CDF boundary lands 1–3 ULPs below the true value.

`_qEstimateTable` uses the strict comparison `p > q`, so `0.5 > 0.4999999999999993` evaluates true and the binary search advances past the correct bucket, overshooting by one.

## Fix

Override `_cdf(x)` in each affected distribution to recompute PMF values directly from the parametric formula, bypassing `pdfTable` and all AliasTable normalization entirely. Use bidirectional summation:

```js
_cdf (x) {
  const { n, alpha, beta } = this.p
  if (x >= n) return 1
  const logBetaAB = logBeta(alpha, beta)    // hoist constant denominator
  let fwd = 0
  for (let k = 0; k <= x; k++) {
    fwd += Math.exp(logBinomial(n, k) + logBeta(k + alpha, n - k + beta) - logBetaAB)
  }
  let bwd = 0
  for (let k = n; k > x; k--) {
    bwd += Math.exp(logBinomial(n, k) + logBeta(k + alpha, n - k + beta) - logBetaAB)
  }
  return Math.min(1, Math.max(fwd, 1 - bwd))
}
```

`fwd` accumulates PMF from the lower support bound to `x` (the forward CDF estimate). `bwd` accumulates PMF from the upper support bound to `x+1` (the survival probability). Their floating-point rounding errors have opposite signs, so `max(fwd, 1 - bwd)` is guaranteed to be ≥ the true CDF at exact boundaries, never below it. `Math.min(1, …)` prevents accumulated upward drift from returning values above 1.

## Prevention Strategy

1. **Any `Categorical` subclass whose PMF involves `logBeta`, `logBinomial`, or other transcendental functions must override `_cdf`** with bidirectional raw-PMF summation or a closed-form expression (e.g., `regularizedBetaIncomplete` for Binomial). Do not rely on `Categorical`'s prefix-sum table for numerical CDF accuracy.

2. **Audit new `Categorical` subclasses for exact CDF boundaries**: construct a symmetric parameter configuration (if one exists) that forces the true CDF to land at exactly 0.5. If `q(0.5)` returns a value one too large, the prefix-sum bias is present.

3. **Never generate quantile test fixtures from the library's own output**. Verify against `scipy`, `mpmath`, or a hand calculation. A fixture derived from buggy output silently suppresses the bug (see `BetaBinomial(25,2,2)` case above).

4. **Add `quantileVals: [{ p: 0.5, x: <true_midpoint> }]`** to every test case for symmetric distributions so any future regression in `_cdf` or `_qEstimateTable` is caught immediately.

5. **Hoist constant log-denominators** (`logBeta(alpha, beta)`, `logBinomial(N, n)`, etc.) outside the loop. These are the same for every iteration; recomputing them O(n) times wastes transcendental function calls.

## Related Solutions

- `solutions/distribution/2026-06-03-0848-binomial-prefix-sum-cdf-quantile-overshoot.md` — same root cause fixed for `Binomial` via `regularizedBetaIncomplete`; established that Neumaier summation cannot fix per-entry rounding errors; prevention rule #3 (no fixtures from library output) was first recorded here.
- `solutions/correctness/2026-05-26-1210-precomputed-cdf-asymmetric-clamping.md` — always return `Math.min(1, …)` when overriding `_cdf` to prevent accumulated floating-point sums from returning values slightly above 1 at the upper boundary.

## Key Insight

When a `Categorical` subclass computes PMF values via `Math.exp(logBinomial + logBeta - logBeta)`, the floating-point total can slightly exceed 1.0, causing AliasTable to scale all weights uniformly downward before summation; because the per-entry rounding happens before accumulation, no amount of compensated summation can recover it — the only fix is to override `_cdf` and recompute raw PMF values directly, using `Math.min(1, Math.max(fwd, 1 - bwd))` bidirectional summation so the result is never below an exact CDF boundary.
