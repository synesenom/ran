---
date: 2026-05-23T14:00:00Z
category: "testing"
problem: "Adding scipy refVals for 105 second parameter cases surfaced silent parameterization traps, stochastic chi-squared failures, and ESLint no-loss-of-precision errors"
status: complete
related_issue: "#135"
related_plan: "thoughts/plans/2026-05-23-1210-issue-135-second-param-cases.md"
tags: [scipy, refvals, parameterization, chi2, eslint, no-loss-of-precision, discrete, continuous, second-cases]
---

# Solution: Second Parameter Cases — scipy Traps, Stochastic Failures, and Float Precision

**Date**: 2026-05-23
**Category**: testing
**Related Issue**: #135

## Problem

Adding a second hand-picked parameter set (with `refVals`) to 105 single-case distributions across `test/dist-cases-continuous.js` and `test/dist-cases-discrete.js` surfaced four classes of failure that had to be identified and corrected before the test suite would pass:

1. **scipy naming and parameterization traps (discrete)**: `scipy.stats.nbinom` uses `p` as the *success* probability, the opposite of ranjs `NegativeBinomial` convention. `YuleSimon(rho=1.5)` has infinite variance, causing chi-squared GoF tests to fail stochastically regardless of seed. `Zeta(s=2.1)` concentrates mass so slowly in the tail that chi-squared binning with `n=10000` is unreliable. `DiscreteWeibull([0.9, 0.5])` failed at multiple seeds because the chosen parameters produce near-degenerate mass at k=0. `HeadsMinusTails` implements `|H-T|` (folded absolute value), not the signed difference — no off-the-shelf scipy distribution matches; it required hand-coded `rv_discrete`.

2. **scipy naming and parameterization traps (continuous)**: `InverseGaussian([0.5, 4])` produces CDF≈1 at all test x-points. `ExponentiatedWeibull` maps `lambda` to `scale=lambda`, not `scale=1/lambda`. `ExponentialLogarithmic` has a formula variant differing from scipy's `exponpow`. `StudentZ` requires `df=n-1` not `df=n`. `JohnsonSB` in scipy is `johnsonsb` not `johnsonnb`. scipy has no `invchi2` — `InverseChi2(nu)` must use `scipy.stats.invgamma(a=nu/2, scale=0.5)`.

3. **ESLint `no-loss-of-precision` triggered by Python `repr()`**: Python's `repr()` for float64 can emit 17-significant-digit literals (e.g., `0.24132156372070312`) that trigger ESLint's `no-loss-of-precision` rule.

4. **Stochastic chi-squared / KS failures from bad parameter choices**: `R(c=2)` reduces to uniform — the chi-squared test on a uniform over many bins is high-variance. `Geometric(p=0.1)` is not exactly representable in binary float. `GeneralizedHermite([0.5, 0.5, 3])` places heavy mass at k=0.

## Root Cause

Two structural causes underlie all failures:

1. At scale (105 second cases added in one session), every distribution family's scipy parameterization must be independently verified — there is no single pattern that covers all cases. Parameters that differ from ranjs convention (sign of rate vs. scale, p vs. 1-p, indexed offset) produce silently plausible but wrong literals if guessed rather than verified.

2. Parameter choices that look statistically reasonable for `refVals` validation (deterministic PDF/CDF comparison) can be poor choices for the companion KS/chi-squared sampling tests, because some parameters produce distributions with infinite moments, near-degenerate modes, or non-binary-fraction probabilities that create systematic noise above the chi-squared critical value.

## Fix

Reference values were generated via `scripts/refvals-issue-135.py` with two protective layers:

- `fmt()` caps output to 15 significant digits via `f'{v:.15g}'` to satisfy ESLint
- Every value was cross-validated against the CJS bundle before embedding

Problem parameter choices were replaced:

| Distribution | Bad params | Fixed params | Reason |
|---|---|---|---|
| YuleSimon | `rho=1.5` | `rho=2.5` | Infinite variance at rho≤2 |
| Zeta | `s=2.1` | `s=5.0` | Too-heavy tail for chi2 n=10000 |
| Geometric | `p=0.1` | `p=0.25` | Non-binary fraction → PMF rounding |
| DiscreteWeibull | `[0.9, 0.5]` | `[0.75, 2]` | Near-degenerate mass at k=0 |
| GeneralizedHermite | `[0.5, 0.5, 3]` | `[3, 2, 2]` | Mode at boundary |
| InverseGaussian | `[0.5, 4]` | `[1, 0.5]` | CDF≈1 at all test points |
| R | `c=2` (uniform) | `c=0.5` (U-shaped) | Uniform → high-variance chi2 |

`HeadsMinusTails` was computed via closed-form combinatorics rather than any scipy call. Embedding was performed via `scripts/embed-second-cases.py`.

## Prevention Strategy

1. **Look up every scipy function name in the docs** — do not infer from distribution name. Known traps: `johnsonnb` is wrong (use `johnsonsb`); `InverseChi2` has no direct scipy equivalent (use `invgamma(a=nu/2, scale=0.5)`); `scipy.stats.nbinom` uses p=success probability (opposite of ranjs).

2. **Before finalising parameter choices for second cases**, check three things:
   - Does the distribution have finite variance at these parameters? (Infinite variance → unreliable chi-squared)
   - Is any probability parameter an exact binary fraction? (Non-binary `p` → PMF rounding accumulates into chi-squared bin errors)
   - Does the mode sit at the support boundary? (Near-degenerate boundary modes → chi-squared bin counts too low)

3. **Enforce 15-significant-digit cap in `fmt()`**: Python's `repr()` can produce 17-digit literals that trigger ESLint `no-loss-of-precision` even when the literal is exactly representable. Use `f'{v:.15g}'` for any value that `repr()` would emit with more than 15 significant digits.

4. **For ambiguous signed vs. folded distributions** (e.g., `HeadsMinusTails`), verify the ranjs source's support range before choosing any reference method — the support reveals which convention is implemented.

5. **Cross-validate every refVals point against the CJS bundle** before embedding: a CDF≈1 return at all test x-values indicates the parameter choice puts all test points in the far right tail.

## Related Solutions

- `solutions/testing/2026-05-17-1825-scipy-parameterization-mismatches-truncatednormal-rice.md` — earlier scipy parameterization trap (TruncatedNormal, Rice) and ESLint float-literal pattern
- `solutions/testing/2026-05-18-1443-discrete-refvals-scipy-parameterization-traps.md` — 8 discrete distributions with documented scipy parameter mapping
- `solutions/special-functions/2026-05-21-1604-marcum-large-mu-asymptotic.md` — ESLint `no-loss-of-precision` scoped-suppression pattern for canonical 16-digit literals
- `solutions/testing/2026-05-16-1915-alias-table-chi2-df-correction.md` — chi-squared bin/df issues in discrete distributions

## Key Insight

When generating scipy refVals for 100+ distributions in a single session, the two most expensive failure classes are (1) silent parameterization traps where scipy uses the opposite convention that produce plausible-looking but wrong literals, and (2) parameter choices that pass the deterministic refVals check but cause stochastic chi-squared failures — the fix for both is to verify CDF monotonicity and boundary behavior from the CJS bundle before committing any parameter set, and to prefer parameters with exact binary-fraction probabilities and finite distribution moments.
