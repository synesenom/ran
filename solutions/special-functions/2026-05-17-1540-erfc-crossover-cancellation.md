---
date: 2026-05-17T15:40:00Z
category: "special-functions"
problem: "erfc lost 2+ digits for x ∈ (1, 2] because its series/CF crossover was set at x=2 (same as erf), causing catastrophic cancellation in 1 - erf(x) near erf ≈ 1"
status: complete
related_issue: "#211"
related_plan: "thoughts/plans/2026-05-17-1130-erf-erfc-continued-fraction.md"
tags: [special-functions, erfc, cancellation, continued-fraction, crossover-threshold, complementary-function, precision, tail-accuracy, dlmf-7.9.2, modified-lentz]
---

# Solution: erf/erfc separate crossover thresholds avoid complementary cancellation

**Date**: 2026-05-17  
**Category**: special-functions  
**Related Issue**: #211

## Problem

`erf` and `erfc` in `src/special/error.js` delegated to `gammaLowerIncomplete(0.5, x²)` /
`gammaUpperIncomplete(0.5, x²)`. After replacing those with a direct hybrid
(Maclaurin series + Laplace CF), using a single crossover threshold of `x = 2` for
both `erf` and `erfc` caused `erfc` to compute `1 - _erfSeries(x)` up to `x = 2` —
where `erf(2) ≈ 0.9953` and the subtraction discards ~2.3 decimal digits via
catastrophic cancellation. The downstream Normal, Levy, and InverseGaussian CDFs
would silently lose precision for arguments in this range.

## Root Cause

Complementary functions need separate crossover thresholds. For `erf`, using the
series for `|x| ≤ 2` is fine because `erf` itself is the output — no subtraction
from 1. For `erfc = 1 - erf`, the subtraction from 1 amplifies any rounding error
in `erf` by a factor of `1 / erfc(x)`. At `x = 2`, `erfc(2) ≈ 0.0047`, so a
relative error of `ε` in `erf(2)` becomes a relative error of `ε / 0.0047 ≈ 213 ε`
in `erfc(2)`. The crossover threshold was incorrectly set equal for both functions.

## Fix

Set the `erfc` crossover independently at `x > 1` (not `x > 2`):

```js
export function erfc (x) {
  if (x > 26.6) return 0
  if (x < 0) return 1 + erf(-x)
  // Use CF directly for x > 1 to avoid cancellation in 1 - erf(x) near 1
  if (x <= 1) return 1 - _erfSeries(x)
  return _erfcCF(x)
}
```

At `x = 1`, `erfc(1) ≈ 0.157` — the subtraction from 1 still retains ~13.8 digits.
For `x > 1`, Laplace's CF (`_erfcCF`) computes `erfc` directly from
`exp(-x²) / (√π · CF(x))` with no subtraction from 1.

The `erf` crossover stays at `x = 2` since `erf` is computed directly (no subtraction
issue), and the complementary `1 - _erfcCF(x)` for large `x` is safe because
`_erfcCF → 0` and the subtraction error is negligible relative to `erf → 1`.

## Prevention Strategy

When implementing any complementary function pair (`f`, `1 - f` or `g`, `exp(-g)`):

1. **Set crossover thresholds independently for each member.** Never copy the crossover
   from the primary function to its complement — the precision budget differs.

2. **Compute the crossover from the cancellation budget.** At the crossover point `x₀`,
   `1 - f(x₀)` should still have at least 13 significant digits. Solve
   `f(x₀) ≤ 1 - 10^{-13}` for `x₀`. For `erf`, this gives `x₀ ≈ 3.1`; using `x = 1`
   is conservative and correct.

3. **Always test the complement directly.** The existing test `erfc(2.0) ≈ 4.677e-3`
   with 1e-10 relative tolerance would have caught this if it had been added earlier.
   Add reference values for both `f` and `1-f` when implementing a complementary pair.

4. **Document the threshold with a WHY comment** giving the numerical justification
   (e.g., `// erfc(1) ≈ 0.157, still full precision; crossover at 2 loses 2.3 digits`).

## Related Solutions

- [`solutions/testing/2026-05-17-1206-closed-form-refvals-without-scipy.md`](../testing/2026-05-17-1206-closed-form-refvals-without-scipy.md) — Cross-validating reference values without scipy; uses `math.erf` for Normal CDF values.

## Key Insight

`erf` and `erfc` need **separate** branch crossover thresholds — using `x > 2` for both
means `erfc` silently loses 2+ digits through catastrophic cancellation in
`1 - erf(x)` across `1 < x ≤ 2`; `erfc` must switch to the Laplace CF at `x > 1`.
