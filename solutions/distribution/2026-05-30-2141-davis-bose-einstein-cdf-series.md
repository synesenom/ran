---
date: 2026-05-30T21:41:30Z
category: "distribution"
problem: "Davis._cdf(x) via Romberg integration took ~100ms per call due to explosive PDF curvature near x=μ"
status: complete
related_issue: "#451"
related_plan: "thoughts/plans/2026-05-30-2054-davis-cdf-series.md"
tags: [davis, cdf, romberg, bose-einstein, series, performance, bernoulli, incomplete-gamma]
---

# Solution: Davis CDF — Dual Bose-Einstein Series Replaces Romberg Integration

**Date**: 2026-05-30T21:41:30Z
**Category**: distribution
**Related Issue**: #451

## Problem

`Davis._cdf(x)` was implemented as Romberg numerical integration over the Davis PDF, taking approximately 100ms per call. This made standard goodness-of-fit testing impractical — the test suite required explicit workarounds (`sampleSize: 100` instead of 5000, and `testSeeds: []` to skip `Distribution.test()` entirely) to avoid multi-minute test runs. The distribution was functionally correct but untestable at normal scale.

## Root Cause

The Davis PDF has explosive curvature near the left support boundary `x = μ`: the denominator `e^{b/(x-μ)} - 1` collapses to zero exponentially fast as `x → μ`, creating an extremely steep integrand near the Romberg lower integration limit. Richardson extrapolation assumes a smooth integrand and requires O(2^j) PDF evaluations at each outer step j to construct its tableau. Without smoothness, extrapolation does not converge, forcing Romberg to iterate up to `MAX_STEPS = 20`, accumulating up to 2^20 ≈ 1,000,000 PDF evaluations per CDF call.

A prior fix (issue #447) added boundary guards and constant caching that reduced cost from minutes to ~100ms, but the Romberg approach itself was not revisited. The 100ms floor is intrinsic to the algorithm given the PDF's shape near the boundary — caching alone cannot overcome the convergence failure of Richardson extrapolation on a non-smooth integrand.

**Practical indicator**: if `_cdf` requires `sampleSize` or `testSeeds: []` workarounds specifically for performance reasons, the CDF algorithm is wrong — not the tests.

## Fix

The substitution `t = b/(x − μ)` transforms the CDF integral into the upper incomplete Bose-Einstein integral `G_n(T) = ∫_T^∞ t^{n-1}/(e^t-1) dt` where `T = b/(x − μ)`. This form has no endpoint singularity and is covered by two rapidly convergent series:

- **T > 2** (x near μ): The geometric series `1/(e^t-1) = Σ e^{-kt}` gives an upper incomplete gamma series:
  `F(x) = (1/ζ(n)) · Σ_{k≥1} Q(n, kT)/k^n`
  Convergence is exponential in k; at T=2 only ~8 terms are needed for machine-epsilon accuracy.

- **T ≤ 2** (x far from μ): The Laurent expansion `1/(e^t-1) = 1/t - 1/2 + Σ B_{2j}/(2j)! · t^{2j-1}` is integrated term by term:
  `1-F(x) = (1/(Γ(n)·ζ(n))) · [T^{n-1}/(n-1) - T^n/(2n) + Σ B_{2j}/(2j)! · T^{n+2j-1}/(n+2j-1)]`
  Convergence radius is 2π; at T=2 only ~10 terms are needed.

The switch point T=2 minimizes worst-case term count across both branches. The Bernoulli coefficients `B_{2j}/(2j)!` are precomputed once at module load as a module-level IIFE constant `B2K_OVER_FACT`. Both building blocks (`gammaUpperIncomplete`, `B2k`) already existed in the codebase. Per-call cost drops from ~100ms to ~1–20μs. The test workarounds were removed and full GoF coverage restored.

## Prevention Strategy

When a distribution's PDF has a singularity or explosive curvature at a support boundary, do not use Romberg (or any Richardson-extrapolation-based) integration for `_cdf`. Instead, look for a change of variables that removes the singularity from the integrand.

For the class of PDFs with factors like `(e^{g(x)} - 1)^{-1}`, the substitution `t = g(x)` maps the CDF to a Bose-Einstein-type integral which has classical dual-series representations. More generally: when a PDF involves `Σ k^{-α} e^{-k·f(x)}` structure after variable substitution, the CDF will decompose into an incomplete gamma sum that can be evaluated term-by-term.

The dual-series threshold-switching pattern (T=2 here) is the same approach used in `erfc` (crossover at x=0.5 between series and continued fraction) and `gammaUpperIncomplete` (crossover at x=s+1). When choosing a threshold, pick the point where both series need equal maximum iterations.

## Related Solutions

- `solutions/distribution/2026-05-27-1530-davis-romberg-boundary-guard-and-constant-cache.md` — the predecessor fix that added boundary guards and constant caching (`this.c.gammaN`, `this.c.zetaN`), reducing cost from minutes to ~100ms and confirming the precomputed constants that this fix relies on.

## Key Insight

When the Davis PDF's explosive curvature near `x = μ` defeats Romberg integration, the substitution `T = b/(x-μ)` converts the CDF into the Bose-Einstein integral `G_n(T)`, which is covered by an upper incomplete gamma series for T > 2 and a Bernoulli/Laurent series for T ≤ 2, reducing each CDF call from ~100ms to ~10μs with ≤10 terms in either branch.
