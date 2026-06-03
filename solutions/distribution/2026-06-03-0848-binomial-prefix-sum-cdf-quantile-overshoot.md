---
date: 2026-06-03T08:48:10Z
category: "distribution"
problem: "Binomial(25,0.5).q(0.5) returns 13 instead of 12 because a 13-term prefix-sum CDF leaves CDF(12) 1 ULP below 0.5"
status: complete
related_issue: "#654"
related_plan: "thoughts/plans/2026-06-03-0708-issue-654-binomial-quantile-overshoot.md"
tags: [binomial, categorical, prefix-sum, cdf, quantile, ULP, floating-point, regularizedBetaIncomplete, _qEstimateTable, discrete]
---

# Solution: Binomial prefix-sum CDF accumulates 1-ULP error, breaking discrete quantile search

**Date**: 2026-06-03T08:48:10Z
**Category**: distribution
**Related Issue**: #654

## Problem

`new ran.dist.Binomial(25, 0.5).q(0.5)` returned `13` instead of the mathematically correct `12`. For a symmetric Binomial(25, 0.5), `CDF(12) = 0.5` exactly by symmetry, so the median must be 12. The bug was silently codified in the test fixture as `{ p: 0.5, x: 13 }` — generated from the buggy library output rather than an independent reference.

## Root Cause

`Binomial` extends `Categorical`, which constructs a `cdfTable` as a running prefix sum of normalized PMF weights. `AliasTable` normalizes each weight by dividing by the floating-point total, introducing per-weight rounding. After 13 terms of cumulative summation, `cdfTable[12]` landed at `0.4999999999999999` (1 ULP below 0.5). The `_qEstimateTable` binary search uses a strict `p > q` comparison (`src/dist/_distribution.js:182`), so `0.5 > 0.4999999999999999` treated the exact boundary as "not yet reached" and advanced the estimate to k=13.

Unlike the companion bug in YuleSimon (#653), there is no single upstream special function to fix. The rounding is distributed across 13 individually rounded normalized weights. Even Kahan/Neumaier summation of already-rounded per-entry weights cannot recover the lost precision — the individual weights themselves are inexact before they are summed.

## Fix

Override `_cdf(x)` in `Binomial` to compute the CDF via `regularizedBetaIncomplete(n-x, x+1, 1-p)` — the standard incomplete beta identity for the binomial CDF — instead of inheriting `Categorical`'s prefix-sum table lookup. A boundary guard `if (x >= n) return 1` handles the upper edge and protects against `a=0` in the continued fraction. The regularized incomplete beta evaluates in a single continued-fraction pass with no inter-term accumulation, returning `~0.5000000000000044` for the CDF(12) case (error `~4.4e-15`, well within the 1e-10 refVals tolerance, and crucially `>= 0.5`). The test fixture was corrected from `x: 13` to `x: 12`, verified against `scipy.stats.binom(25, 0.5).ppf(0.5) = 12`.

This mirrors the existing `NegativeBinomial._cdf` in the same codebase, which uses the same incomplete beta identity for the same reason.

## Prevention Strategy

1. **Multi-term prefix sums are not a reliable CDF source when a closed-form incomplete-beta formula exists.** When a distribution subclasses `Categorical` for sampling convenience but its CDF has a single-pass closed-form via `regularizedBetaIncomplete`, always override `_cdf` with the closed-form. The prefix-sum table is O(1) and correct for sampling; it is not a numerically stable CDF evaluator when summation error can reach a "round" probability boundary.

2. **After any discrete quantile overshoot, check whether the CDF is a multi-term accumulated sum.** If it is, the fix is to replace the accumulation with a direct closed-form. Patching `_qEstimateTable` with fuzzy tolerance is explicitly contraindicated — see `solutions/special-functions/2026-06-03-0920-beta-integer-lanczos-ulp-quantile-overshoot.md`.

3. **Never generate quantile test fixtures from the library's own output.** Verify against scipy, mpmath, or a hand calculation. A fixture derived from buggy output suppresses the bug in all future test runs.

4. **When a distribution inherits `_cdf` from a parent built for a different purpose, audit numerical appropriateness.** `Categorical` was designed for O(1) alias-table sampling; inheriting its `_cdf` is only safe when no "round" probability boundaries exist within the support.

## Related Solutions

- [`solutions/special-functions/2026-06-03-0920-beta-integer-lanczos-ulp-quantile-overshoot.md`](../special-functions/2026-06-03-0920-beta-integer-lanczos-ulp-quantile-overshoot.md) — YuleSimon quantile overshoot from a single-function ULP error in `beta(1,4)`; established the "fix the source, not `_qEstimateTable`" rule.
- [`solutions/testing/2026-05-20-0459-discrete-quantile-ceil-minus-one-pattern.md`](../testing/2026-05-20-0459-discrete-quantile-ceil-minus-one-pattern.md) — Discrete quantile off-by-one from floor/ceil in closed-form inverses; prevention rule #3 (don't generate fixtures from library output) applies here too.

## Key Insight

When a discrete distribution subclasses `Categorical` for O(1) sampling but its CDF has a closed-form via `regularizedBetaIncomplete`, override `_cdf` with the closed-form — a multi-term prefix sum of AliasTable-normalized weights accumulates enough rounding error to leave CDF(k) 1 ULP below an exact boundary, silently breaking the strict-comparison quantile search in a way that no summation compensation can fix after per-entry rounding has already occurred.
