# ADR-0013: Taylor series for besselISpherical at small |x|

**Date**: 2026-05-28
**Status**: Accepted

## Context

The closed-form expression for the modified spherical Bessel function i_n(x) used for n ≥ 1 suffers catastrophic cancellation at small |x|. For n = 1 the formula is `(cosh(x) - sinh(x)/x) / x`. Near x = 0, `cosh(x) ≈ 1 + x²/2` and `sinh(x)/x ≈ 1 + x²/6`, so the subtraction loses roughly `2/x²` ulps of precision — the relative error grows as `2ε / (x²/3)`, which reaches 100% near x ≈ `√(6ε) ≈ 3.7e-8`.

The same cancellation affects all n ≥ 2 via the Wronskian path.

## Decision

For |x| < 1, evaluate i_n(x) (n ≥ 1) using the Taylor series:

```
i_n(x) = Σ_{k=0}^∞  x^{n+2k} / (2^k k! (2n+2k+1)!!)
```

The convergence ratio is `x² / (2(k+1)(2n+2k+3))`, which is at most 1/10 per step at the threshold |x| = 1, giving geometric convergence to machine epsilon in roughly 16 iterations. The threshold |x| < 1 keeps the relative error of the Taylor series below 2ε throughout the range.

The helper `_besselISphericalTaylor(n, x)` implements this series. Because the leading term is proportional to `x^n`, the function naturally returns 0 at x = 0 for all n ≥ 1, eliminating the need for special-case x = 0 guards.

## Consequences

- `besselISpherical(n, x)` is now accurate to machine epsilon for all |x| < 1, n ≥ 1.
- The closed-form Wronskian path is only reached for |x| ≥ 1, where cancellation is bounded to at most a few bits.
- The Taylor series loop uses `MAX_ITER` as a safety bound (convention shared by all other series loops in `src/special/`).
- The threshold constant `_BESSEL_I_SPH_THRESHOLD = 1` is named so it can be adjusted, but lowering it below the cancellation onset would reintroduce the error.
