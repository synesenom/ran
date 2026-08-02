---
date: 2026-05-28T00:00:00Z
category: "special-functions"
problem: "besselISpherical(n, x) loses precision from catastrophic cancellation at small |x|"
status: complete
related_issue: "N/A"
related_plan: "N/A"
tags: [bessel, cancellation, taylor-series, spherical-bessel, precision]
---

# Solution: Taylor series for besselISpherical at small |x|

**Date**: 2026-05-28T00:00:00Z
**Category**: special-functions
**Related Issue**: N/A

## Problem

The closed-form expression for the modified spherical Bessel function i_n(x) used for n ≥ 1
suffers catastrophic cancellation at small |x|. For n = 1 the formula is
`(cosh(x) - sinh(x)/x) / x`. Near x = 0, `cosh(x) ≈ 1 + x²/2` and `sinh(x)/x ≈ 1 + x²/6`, so the
subtraction loses roughly `2/x²` ulps of precision — the relative error grows as `2ε / (x²/3)`,
which reaches 100% near x ≈ `√(6ε) ≈ 3.7e-8`.

The same cancellation affects all n ≥ 2 via the Wronskian path.

## Root Cause

The closed-form Wronskian expression is a difference of two terms that individually grow like
`x^0` while the true result grows like `x^n` — subtracting two near-equal `O(1)` quantities to
recover an `O(x^n)` result is inherently lossy for small x, regardless of how each term is
computed.

## Fix

For |x| < 1, evaluate i_n(x) (n ≥ 1) using the Taylor series instead of the closed form:

```
i_n(x) = Σ_{k=0}^∞  x^{n+2k} / (2^k k! (2n+2k+1)!!)
```

The convergence ratio is `x² / (2(k+1)(2n+2k+3))`, which is at most 1/10 per step at the
threshold |x| = 1, giving geometric convergence to machine epsilon in roughly 16 iterations. The
threshold |x| < 1 keeps the relative error of the Taylor series below 2ε throughout the range.

`_besselISphericalTaylor(n, x)` (`src/special/bessel.js`) implements this series. Because the
leading term is proportional to `x^n`, the function naturally returns 0 at x = 0 for all n ≥ 1,
eliminating the need for special-case x = 0 guards.

`besselISpherical(n, x)` is now accurate to machine epsilon for all |x| < 1, n ≥ 1. The closed-form
Wronskian path is only reached for |x| ≥ 1, where cancellation is bounded to at most a few bits.
The Taylor series loop uses `MAX_ITER` as a safety bound (convention shared by all other series
loops in `src/special/`). The threshold constant `_BESSEL_I_SPH_THRESHOLD = 1` is named so it can
be adjusted, but lowering it below the cancellation onset would reintroduce the error.

## Prevention Strategy

Any closed-form special-function expression that is a difference of same-order-of-magnitude terms
should be checked for a small-argument regime where the true result is asymptotically smaller than
either term — that is the signature of catastrophic cancellation. Prefer a convergent series (or
other cancellation-free form) below a threshold chosen so the series' own truncation error stays
below the closed form's cancellation error at that threshold.

## Related Solutions

No related past solutions found.

## Key Insight

When a closed-form expression subtracts two `O(1)` quantities to produce an `O(x^n)` result,
switch to a directly convergent series below the cancellation onset rather than trying to
stabilize the subtraction itself.
