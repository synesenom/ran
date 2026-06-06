---
date: 2026-06-06T12:21:00Z
category: "distribution"
problem: "BetaGeometric CDF required O(k) PreComputed table; telescoping Beta identity yields O(1) closed form"
status: complete
related_issue: "#703"
related_plan: "thoughts/plans/2026-06-06-0910-beta-geometric-distribution.md"
tags: [beta-geometric, discrete, telescoping, beta-function, precomputed, expm1, cancellation, cdf-closed-form]
---

# Solution: BetaGeometric Telescoping CDF

**Date**: 2026-06-06T12:21:00Z
**Category**: distribution
**Related Issue**: #703

## Problem

The BetaGeometric distribution was a `PreComputed` stub: its CDF was computed by summing PMF values up to k. This produced O(k) CDF evaluation, floating-point accumulation error (CDF could exceed 1.0 for large k), and an unexported, untested distribution. The PMF method was named `_pk` (wrong convention), support docs said `k ∈ {0,...,n}` instead of `k ∈ {1,2,3,...}`, and a stale TODO comment remained.

## Root Cause

The CDF closed form was not recognized: the PMF numerator `B(α+1, β+k-1)` was not expanded via the standard Beta recurrence before the original stub was written. The telescoping identity that collapses the partial sum into two terms was overlooked.

## Fix

Applied the Beta recurrence `B(a+1, b) = (a/(a+b)) B(a,b)`, which implies:

```
B(α+1, β+k-1) = B(α, β+k-1) - B(α, β+k)
```

Summing the PMF from 1 to K telescopes:

```
F(K) = Σ_{k=1}^{K} [B(α,β+k-1) - B(α,β+k)] / B(α,β)
     = [B(α,β) - B(α,β+K)] / B(α,β)
     = 1 - B(α,β+K) / B(α,β)
```

Two refinements applied on top of the closed form:

1. **Cached normalizer**: `logBeta(α,β)` is constant across calls → stored as `this.c.logBetaNorm` at construction, avoiding a `logGamma` evaluation on every `_pdf`/`_cdf` call.

2. **`expm1` for small CDF**: `1 - exp(logBeta(α,β+x) - logBetaNorm)` loses precision when the log-ratio is near 0 (small x, or α ≪ β). Replaced with `-Math.expm1(logBeta(α,β+x) - logBetaNorm)`.

Final implementation:

```js
this.c = { logBetaNorm: logBeta(alpha, beta) }

_pdf (x) {
  return x < 1 ? 0 : Math.exp(logBeta(this.p.alpha + 1, this.p.beta + x - 1) - this.c.logBetaNorm)
}

_cdf (x) {
  return x < 1 ? 0 : -Math.expm1(logBeta(this.p.alpha, this.p.beta + x) - this.c.logBetaNorm)
}
```

Reference values for the test suite were derived as exact rational fractions (no scipy — BetaGeometric has no scipy equivalent). The `α=0.5,β=1.5` parameter set was excluded from chi-squared GoF sampling because Q(0.95)=509 would require ~1000 bins.

## Prevention Strategy

Before reaching for `PreComputed` for a discrete distribution whose PMF involves a Beta-function ratio:

1. Try the identity `B(a+1,b) = B(a,b) - B(a,b+1)` (or its symmetric form) on the PMF numerator. If the PMF can be written as `f(k) = [g(k-1) - g(k)] / Z`, the CDF telescopes to `F(K) = [g(0) - g(K)] / Z`.
2. Once a closed-form CDF of the shape `1 - exp(small)` is found, immediately apply `-Math.expm1(...)`.
3. Cache every special-function call that depends only on constructor parameters in `this.c`.

## Related Solutions

- `solutions/correctness/2026-05-26-1210-precomputed-cdf-asymmetric-clamping.md` — explains why PreComputed CDFs can exceed 1.0 via float accumulation (motivates migration)
- `solutions/distribution/2026-06-03-0848-binomial-prefix-sum-cdf-quantile-overshoot.md` — discrete CDF accumulation error causing quantile overshoot (same failure class)
- `solutions/special-functions/2026-05-17-1540-erfc-crossover-cancellation.md` — expm1/erfc cancellation fix pattern applied here
- `solutions/correctness/2026-05-18-1133-inverse-chi2-cdf-complementary-gamma.md` — complementary-form pattern for avoiding `1 - exp(...)` cancellation

## Key Insight

For discrete distributions whose PMF is a ratio of Beta functions, the identity `B(a+1,b) = B(a,b) - B(a,b+1)` turns the CDF partial sum into a two-term telescoping collapse, yielding an O(1) closed-form CDF; once the result is `1 - exp(small)`, use `-Math.expm1(...)`.
