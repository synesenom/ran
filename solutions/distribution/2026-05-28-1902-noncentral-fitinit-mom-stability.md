---
date: 2026-05-28T19:02:00
category: "distribution"
problem: "4th-moment instability in NoncentralChi _fitInit, NaN path in F-family _fitInit, and delegation pattern for doubly-noncentral collapsed distributions"
status: complete
related_issue: "#439"
related_plan: "thoughts/plans/2026-05-28-1805-fitinit-noncentral-distributions.md"
tags: [fitinit, method-of-moments, numerical-stability, noncentral, 4th-moment, isFinite, delegation]
---

# Solution: Noncentral _fitInit MOM stability

**Date**: 2026-05-28T19:02:00
**Category**: distribution
**Related Issue**: #439

## Problem

Three classes of bugs appeared when implementing `static _fitInit(data)` for the nine
noncentral/doubly-noncentral distributions:

1. **NoncentralChi 4th-moment noise**: The plan used `E[X²] = mean(X⁴) - mean(X²)²` (sample 4th
   moment) to estimate the second moment of the squared variate. With n=300 samples this
   returned wildly wrong values — `[7, 0.815]` for planted `[4, 2]`.

2. **F-family NaN path**: `d1formula = Math.round(2*d2²*(d2-2) / (variance*(d2-2)²*(d2-4) - 2*d2²))`.
   When the denominator is zero, `Math.round(x / 0) = Infinity`. The guard `d1formula > 0`
   passes for `Infinity`, then `mean * d1 * (d2-2)/d2 - d1` with `d1=Infinity` yields `NaN`.
   Affected: `NoncentralF` and `DoublyNoncentralF`.

3. **DoublyNoncentralChi2 non-identifiability**: The plan split k and λ independently. But by
   the Poisson convolution theorem the double-Poisson sum collapses *exactly* to
   `NoncentralChi2(k1+k2, λ1+λ2)` — individual k₁,k₂ and λ₁,λ₂ are not recoverable from
   moments, only their sums.

## Root Cause

1. **4th-moment instability**: Sample kurtosis has O(n⁻¹) variance — its relative error for
   n=300 is ~17%. Subtracting two large noisy quantities `mean(X⁴) - mean(X²)²` amplifies
   that noise catastrophically for the NoncentralChi case.

2. **isFinite gap**: JavaScript's `Math.round(Infinity) === Infinity` and
   `Infinity > 0 === true`, so a bare positivity guard does not catch the Infinity path.

3. **Poisson convolution**: `f_{χ²}(x; k1+k2+2j+2l)` depends only on `j+l`, so the double
   sum `Σ_j Σ_l` with Poisson weights `p(j;λ1/2)*p(l;λ2/2)` collapses via the convolution
   property of Poisson distributions — the result is exactly `NoncentralChi2(k1+k2, λ1+λ2)`.
   Neither k₁ vs k₂ nor λ₁ vs λ₂ can be identified from data alone.

## Fix

1. **NoncentralChi**: Replace 4th-moment estimator with the algebraic identity
   `E[X²] = Var[X] + (E[X])²`, which holds exactly for any distribution and uses only the
   stable first two sample moments:
   ```js
   const half = Math.max(1, (mean * mean + variance) / 2)
   return [Math.max(1, Math.round(half)), Math.max(1e-3, Math.sqrt(half))]
   ```
   See `src/dist/noncentral-chi.js`.

2. **F-family**: Add `isFinite` to the guard:
   ```js
   const d1 = d1formula > 0 && isFinite(d1formula) ? Math.max(1, d1formula) : d2
   ```
   See `src/dist/noncentral-f.js` and `src/dist/doubly-noncentral-f.js`.

3. **DoublyNoncentralChi2**: Delegate to `super._fitInit(data)` to get
   `[kTot, lambdaTot]`, then split symmetrically:
   ```js
   static _fitInit (data) {
     const [kTot, lambdaTot] = super._fitInit(data)
     const k = Math.max(1, Math.round(kTot / 2))
     return [k, Math.max(1, kTot - k), lambdaTot / 2, lambdaTot / 2]
   }
   ```
   See `src/dist/doubly-noncentral-chi2.js`.

## Prevention Strategy

- **For any `_fitInit` that estimates a second moment of a transformed variate**: use
  `Var[X] + (E[X])²` instead of `E[X⁴] - (E[X²])²`. The 4th-moment path is numerically
  unstable at realistic sample sizes.
- **For any formula that round-divides a computed quantity**: add `isFinite(formula)` to the
  guard. `Math.round(x/0) = Infinity` in JavaScript, and `Infinity > 0 = true`.
- **For doubly-parametrized distributions whose PDF depends only on parameter sums**:
  delegate to the parent's `_fitInit` and split the totals symmetrically. Do not try to
  recover individual parameters that the data cannot distinguish.

## Related Solutions

- `solutions/distribution/2026-05-20-1838-doubly-noncentral-chi2-additivity-collapse.md` — documents the Poisson convolution collapse for DoublyNoncentralChi2

## Key Insight

For MOM initialization at realistic sample sizes (n≲1000), always estimate second moments
via `Var[X] + (E[X])²` rather than sample 4th moments — the algebraic identity is exact,
numerically stable, and requires nothing beyond the sample mean and variance already computed.
