---
date: 2026-05-28T11:20:00Z
category: "distribution"
problem: "LogSeries._fitInit used wrong asymptotic inversion: p ≈ 1 - 1/mean instead of 1 - 1/sqrt(mean)"
status: complete
related_issue: "#438"
related_plan: "thoughts/plans/2026-05-28-1106-fitinit-discrete-438.md"
tags: [fitInit, log-series, moment-of-moments, asymptotic, Hill-estimator, power-law]
---

# Solution: LogSeries _fitInit Asymptotic Inversion Error

**Date**: 2026-05-28
**Category**: distribution
**Related Issue**: #438

## Problem

The first-draft `_fitInit` for `LogSeries` used `p ≈ 1 - 1/mean` to seed the Nelder-Mead optimizer. For any dataset with mean > 2, this formula produces a starting point severely below the true `p`, causing the optimizer to waste iterations or converge to a poor local optimum. For example, at p=0.9 (true E[X] ≈ 4.34), the formula yields p≈0.77 instead of 0.9.

## Root Cause

The log-series distribution has E[X] = -p / ((1-p) ln(1-p)). Near p → 1, both (1-p) and -ln(1-p) vanish, so the asymptotic behavior is:

E[X] ≈ 1 / (1-p)²

not the linear E[X] ≈ 1/(1-p) found in geometric/Borel-family distributions. The plan conflated log-series with the geometric family and inverted the wrong relation.

The correct inversion of E[X] ≈ 1/(1-p)² gives:
- (1-p) ≈ 1/sqrt(mean)
- p ≈ 1 - 1/sqrt(mean)

## Fix

`src/dist/log-series.js`: changed the `_fitInit` seed from `1 - 1/mean` to `1 - 1/Math.sqrt(mean)`, with a WHY comment making the asymptotic explicit.

```js
// E[X] ≈ 1/(1-p)^2 for p near 1; inverting gives p ≈ 1 - 1/sqrt(mean).
const mean = data.reduce((s, x) => s + x, 0) / data.length
return [Math.max(0.01, Math.min(0.99, 1 - 1 / Math.sqrt(mean)))]
```

Additionally, `Zeta._fitInit` and `Zipf._fitInit` received a guard for `sumLog <= 0` (all data equal to 1), which would otherwise produce `s = Infinity` via `n/sumLog` and trap the optimizer at a boundary cliff.

## Prevention Strategy

When writing `_fitInit` for any distribution whose mean is not linear in its natural parameter (log-series, Borel, Yule-Simon, Polya-Aeppli, etc.):

1. Write out the full asymptotic expansion of E[X] near the boundary parameter value.
2. Verify the inversion at a concrete test point: compute `E[X]` at a known `p`, run `_fitInit([E[X], E[X], ...])`, and confirm it returns back the original `p` (within MoM tolerance).
3. For Hill estimators and other log-sum denominators, always guard against `sumLog <= 0` before computing `n / sumLog`.

## Related Solutions

- See `solutions/distribution/` for other distribution-fitting patterns.

## Key Insight

For the log-series distribution, E[X] grows as 1/(1-p)² near p → 1 (not as 1/(1-p)), so the moment-of-moments initializer must invert using `p ≈ 1 - 1/sqrt(mean)` — using the linear inversion `1 - 1/mean` silently produces a severe underestimate of p for any heavy-tailed sample.
