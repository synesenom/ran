---
date: 2026-06-14T12:40:00Z
category: "special-functions"
problem: "E₁ asymptotic expansion used instead of continued fraction, silently giving ~4% error at z=5"
status: complete
related_issue: "#582"
related_plan: "thoughts/plans/2026-06-14-0800-analytical-moments-survival-distributions.md"
tags: [e1, exponential-integral, asymptotic-expansion, continued-fraction, lentz, cancellation, crossover, moment-override]
---

# Solution: E₁ asymptotic-vs-CF crossover

**Date**: 2026-06-14
**Category**: special-functions
**Related Issue**: #582

## Problem

The `e1(z)` implementation used a divergent asymptotic expansion for z > 4 and an alternating Taylor series for z ≤ 4. This produced silent relative errors of ~4% at z = 5 and degraded precision throughout z ∈ [4, ~30] — large enough to corrupt `Gompertz.mean()` (which calls `e1(eta)`) and `Muth.variance()` (which calls `e1(1/alpha)`). No test covered the asymptotic branch with a tight tolerance, so the error went undetected through the validate stage.

## Root Cause

The asymptotic expansion E₁(z) ≈ (e^{−z}/z)·Σ(−1)^n·n!/z^n is divergent: truncated optimally at the smallest term, its absolute error is approximately |t_{N_opt}|·e^{-z}/z. At z = 5, this error is ~5×10^{−5} against E₁(5) ≈ 1.15×10^{−3}, giving ~4% relative error. The series branch with crossover z ≤ 4 also had a subtle cancellation issue: alternating partial sums at z = 4 reach magnitudes of ~100 before canceling to a result of ~0.004, losing ~4 significant digits.

The plan had explicitly called for A&S 5.1.22 continued fraction for z > 1. The implementation deviated to the asymptotic (simpler to write) without recognizing that "asymptotic" is not interchangeable with "approximation" — it is a divergent series whose best achievable error is bounded by the smallest term, not by the number of terms taken.

## Fix

- Series branch restricted to 0 < z ≤ 1 (no cancellation at small z)
- z > 1: A&S 5.1.22 CF via modified Lentz method, numerators `ceil((n−1)/2)` alternating denominators `1` and `z`

The CF converges geometrically, needs ≤ 50 iterations for z > 1, and delivers full double precision (≤ 1 ULP) across all z > 0.

Tests added to `test/special.js` cover series branch (z = 0.5, 1), CF branch (z = 2, 5, 10) with `equal()` tolerance ~1e-10, and boundary conditions (z=0→Infinity, z<0→NaN).

## Prevention Strategy

Before choosing between series, CF, or asymptotic expansion for any special function:

1. **The asymptotic expansion is divergent** — always check that the truncation error (|first omitted term| × scaling) meets the project's 1e-14 precision gate at the proposed crossover. For E₁, the asymptotic does not achieve 1e-14 precision until z ≳ 40.
2. **Series near large z** — if alternating partial sums exceed the result by a factor of K, you lose log₁₀(K) significant digits; cap the series crossover at z where K < 10.
3. **Plan-specified algorithms are not optional** — if a plan specifies CF and the implementation uses asymptotic, that is a correctness deviation, not a simplification. Flag it during review with reference values at the critical z range.
4. **New special functions need direct tests** — if `test/special.js` has no `describe('.e1()')` block, the CI gate cannot catch algorithm deviations in untested branches. Add CF-branch reference values immediately.

## Related Solutions

- [erfc crossover and cancellation](solutions/special-functions/2026-05-17-1540-erfc-crossover-cancellation.md) — same pattern: wrong crossover between series and asymptotic causing silent precision loss
- [InverseGaussian erfc cancellation / CF convergence](solutions/special-functions/2026-06-05-0000-inverse-gaussian-cdf-erfc-cancellation-cf-convergence.md) — demonstrates CF as the correct remedy for cancellation near crossover

## Key Insight

The asymptotic expansion for E₁(z) is divergent and silently achieves only ~4% accuracy at z = 5 — when a plan specifies a continued fraction for a special function, using an asymptotic expansion instead is not a simplification but a correctness regression that only surfaces if the test suite includes reference values with a tight tolerance at the critical z range.
