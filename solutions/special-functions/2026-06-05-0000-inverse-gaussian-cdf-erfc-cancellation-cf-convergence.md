---
date: 2026-06-05T00:00Z
category: "special-functions"
problem: "InverseGaussian._cdf lost ~5e-12 in the lower tail due to 1+erf cancellation and under-converged erfc CF"
status: complete
related_issue: "#690"
related_plan: "thoughts/plans/2026-06-04-2052-inverse-gaussian-cdf-precision.md"
tags: [erfc, erfcx, cancellation, continued-fraction, convergence, inverse-gaussian, lower-tail, precision]
---

# Solution: InverseGaussian CDF — erfc cancellation and CF convergence (#690)

**Date**: 2026-06-05
**Category**: special-functions
**Related Issue**: #690

## Problem

`InverseGaussian._cdf` produced relative errors of ~5e-12 for parameter sets `[1, 0.5]` and
`[3, 1]`, large enough that the precision gate carried explicit per-parameter-set tolerance
overrides of `5e-12` (pdf/cdf) and `1e-10`/`1e-11` (quantile). The distribution was accurate
in the upper tail but quietly lost significant digits in the lower tail (small x relative to μ).

## Root Cause

Two compounding issues degraded precision simultaneously.

**Issue 1 — `1 + erf(a)` cancellation.**
The lower-tail branch computed `0.5 * (1 + erf(a))` where `a ≈ −1`. When `erf(a) ≈ −1`,
the sum `1 + erf(a)` suffers catastrophic cancellation: both operands are near ±1, and the
small positive result retains only a few significant bits. An existing upper-tail guard
(`if (1 − z > Number.EPSILON)`) correctly avoided `1 − erf` cancellation, but there was no
symmetric guard for the `1 + erf` case in the lower tail.

**Issue 2 — Laplace CF under-convergence near x = 1.**
The Laplace continued fraction in `_erfcCF` (DLMF 7.9.2, Lentz algorithm) ran for at most
`MAX_ITER = 100` iterations. The CF requires up to **188 iterations** to converge for x ≈ 1.0
and up to ~158 for x ≈ 1.1. For x ∈ (1, 1.5) the CF was still under-converged at iteration
100, returning systematically wrong values (e.g., erfc(1.1058) off by ~4e-14 absolute). This
meant that even the upper-tail path — which already called `erfc` directly — was producing
errors, compounding the cancellation issue.

## Fix

Three coordinated changes eliminated both issues.

**1. Raised CF iteration limit from 100 to 250.**
`_erfcLaplaceCF(x)` is extracted as a shared inner helper (returning the Lentz `f` value
without the exp factor). The loop now runs up to 250 iterations with early exit on
`|δ − 1| < EPS`, ensuring convergence for all x ≥ 1. Both `_erfcCF` and the new `_erfcxCF`
call this helper.

**2. Added `erfcx(x) = exp(x²)·erfc(x)` to `src/special/error.js`.**
For `x > 1` it calls `_erfcxCF` (the CF without the `exp(−x²)` factor), staying finite even
as `erfc(x)` underflows to 0 for large x. Three branches: `x ≤ 0` (direct, safe); `0 < x ≤ 1`
(series times bounded `exp(x²) ≤ e`); `x > 1` (CF form).

**3. Rewrote `InverseGaussian._cdf` as a single unconditional expression.**
```js
return Math.min(1, 0.5 * (erfc(-a) + erfcx(b) * Math.exp(this.c.twoLambdaOverMu - b * b)))
```
The identity `1 + erf(a) = erfc(−a)` eliminates both-tail cancellation — no conditional
branch needed. The second term uses `erfcx(b) * exp(twoLambdaOverMu − b²)` where the
exponent equals `−λ(x−μ)²/(2μ²x) ≤ 0` always, preventing overflow even for extreme
`2λ/μ`. The constructor now stores `twoLambdaOverMu = 2λ/μ` instead of
`expTwoLambdaOverMu = exp(2λ/μ)`, eliminating a potential constructor overflow too.

**Result**: InverseGaussian CDF/quantile precision lifted from ~5e-12 to the 1e-14 gate for
all parameter sets; tolerance overrides removed.

## Prevention Strategy

1. **Never use `1 ± erf(t)` in code.** It is always equivalent to an `erfc` call with no
   cancellation: `1 + erf(t) = erfc(−t)` and `1 − erf(t) = erfc(t)`. Replace immediately.

2. **Validate CF iteration budgets against published convergence bounds.** The Laplace CF
   (DLMF 7.9.2) requires up to 188 iterations near x = 1.0. A generic `MAX_ITER = 100` can
   silently under-converge near the series/CF crossover. Hardcode a function-specific limit
   (250 here) rather than sharing a global constant when the published bound exceeds it.

3. **Pre-computing `exp(2λ/μ)` in a constructor is dangerous for extreme parameters.** Defer
   the exp to the call site, or reformulate to guarantee the exponent is non-positive at
   runtime. The `erfcx(b) * exp(K − b²)` pattern (with K − b² ≤ 0 provably) is the safe form.

## Related Solutions

- [`solutions/special-functions/2026-05-17-1540-erfc-crossover-cancellation.md`](../special-functions/2026-05-17-1540-erfc-crossover-cancellation.md) — erfc series/CF crossover fix (#211); established the pattern of using CF directly to avoid `1 − erf` cancellation. This solution applies the symmetric fix for `1 + erf`.
- [`solutions/special-functions/2026-06-01-1330-bessel-i-miller-normalization-max-iter-truncation.md`](../special-functions/2026-06-01-1330-bessel-i-miller-normalization-max-iter-truncation.md) — besselI normalization truncated at MAX_ITER=100, wrong by orders of magnitude for large x (#544). Same root cause: a shared iteration constant that was too small for one specific series.

## Key Insight

The identity `½(1 + erf(t)) = ½·erfc(−t)` is exact and free — whenever a CDF contains
`1 ± erf(·)`, replace it with `erfc(∓·)` to eliminate catastrophic cancellation in both
tails simultaneously, and always verify CF iteration limits against the published worst-case
convergence depth rather than trusting a shared constant.
