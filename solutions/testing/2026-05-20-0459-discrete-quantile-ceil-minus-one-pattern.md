---
date: 2026-05-20T04:59:40Z
category: "testing"
problem: "Discrete _q off-by-one when p lands exactly on a CDF step; cdfMonotonicity no-op; no quantile roundtrip test"
status: complete
related_issue: "#212"
related_plan: "thoughts/plans/2026-05-19-2048-property-tests-issue-212.md"
tags: [quantile, discrete, floor-ceil, off-by-one, property-test, cdf-monotonicity, bernoulli, geometric, skellam]
---

# Solution: Discrete quantile `ceil(x)-1` pattern and property test infrastructure

**Date**: 2026-05-20T04:59:40Z
**Category**: testing / correctness
**Related Issue**: #212

## Problem

Five discrete distribution quantile functions returned wrong values for specific inputs, yet the test suite gave no signal. `Geometric(0.5).q(0.5)` returned `1` instead of `0`. `Bernoulli(0.5).q(0.75)` always returned `0`. `Skellam(5,5).q(0.05)` returned a value whose CDF was 4% below the target probability.

The failures were invisible because `Tests.cdfMonotonicity` was a silent no-op (it asserted `p2 > p1`, comparing two x-domain scalars by name, never calling `d.cdf()` at all), and no quantile roundtrip test existed.

## Root Cause

Three independent bugs across the five distributions, plus one test infrastructure bug:

**1. `cdfMonotonicity` variable naming collision**: Local variables were named `p1`/`p2` but held x-domain coordinates, not probabilities. The assertion `assert(p2 > p1)` is always true by construction and never exercises the CDF.

**2. Algebraic inverse quantile anti-pattern (`Math.floor` on k+1)**: For `DiscreteUniform`, `Geometric`, and `DiscreteWeibull`, the closed-form `_q` computed `Math.floor(algebraic_inverse_of_k_plus_1)`. When `p` exactly equals a CDF step value, the algebraic inverse is exactly the integer `k+1`, and `Math.floor(k+1) = k+1` instead of `k`. This is the correct quantile `Q(p)` only if `CDF(k) < p`, but when `CDF(k) = p` exactly, `k` is the correct infimum.

**3. Parent constructor parameter shadowing (Bernoulli)**: `Bernoulli` extends `Categorical`, whose constructor overwrites `this.p` with `{ n, weights, min }`. `Bernoulli._q` referenced `this.p.p`, which is `undefined`. The condition `p > 1 - undefined` is `false` for all `p`, so `_q` always returned `0`.

**4. Continuous root undershoots step boundary (Skellam)**: `_qEstimateRoot` applies Brent root-finding on the continuous interpretation of the Skellam CDF (a step function). The root of `CDF(x) - p = 0` for a step function lands at approximately `k - ε` (just left of the jump). `Math.floor(k - ε) = k - 1`, which has `CDF(k-1) < p`.

## Fix

**Test infrastructure:**
- Renamed `p1`/`p2` → `x1`/`x2` in `cdfMonotonicity`; replaced the arithmetic assertion with `assert(d.cdf(x2) >= d.cdf(x1))`.
- Added `Tests.quantileRoundtrip` with the correct two-sided discrete infimum check: `cdf(q(p)) >= p` AND (when `q(p) > support_min`) `cdf(q(p) - 1) < p`. Continuous: `|cdf(q(p)) - p| < 1e-6`. Fixed probability grid: `ROUNDTRIP_PROBS = [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95]`.

**Algebraic inverse fix (DiscreteUniform, Geometric, DiscreteWeibull):**
Replace `Math.floor(expr)` with `Math.ceil(expr) - 1`. For non-integer arguments they are identical; at exact integers `ceil(n) - 1 = n - 1` (correct) vs `floor(n) = n` (wrong).

**Geometric p=1 edge case:**
`Math.ceil(log(1-p) / log(0)) - 1 = Math.ceil(0) - 1 = -1`. Added guard `if (this.p.p === 1) return 0`.

**Bernoulli:** Use `this.p.weights[0]` (the weight stored by the Categorical parent for outcome 0) instead of the undefined `this.p.p`.

**Skellam:** After `let k = Math.floor(_qEstimateRoot(p))`, add `if (this.cdf(k) < p) k++`.

## Prevention Strategy

1. **`ceil(expr) - 1` for discrete algebraic quantiles**: Whenever implementing `_q` with a closed-form algebraic inverse for a discrete distribution, use `Math.ceil(expr) - 1` instead of `Math.floor(expr)`. They agree for irrational results; `ceil - 1` is correct at exact integers, which occurs whenever `p` is a rational number whose denominator divides the distribution's period.

2. **Variable names in property tests must match their domain**: A variable named `p` will be read as a probability. Use `x` for domain values. A monotonicity helper with variables named `p1`/`p2` will mislead maintainers into thinking the assertion compares probabilities.

3. **Subclass `this.p` shadowing**: When a discrete distribution subclasses another, never access the original constructor parameter via `this.p.original_name` — the parent constructor may overwrite `this.p` entirely. Access the stored representation (e.g., `this.p.weights[0]`). Audit `_q`, `_pdf`, `_cdf`, and `_generator` for any `this.p.<param>` access in subclasses.

4. **Continuous root-finder for discrete quantiles**: Any `_q` that calls `_qEstimateRoot` and floors the result must post-correct: `if (this.cdf(k) < p) k++`. The root of a step function in continuous space always undershoots the integer boundary by ε.

5. **Add `quantileRoundtrip` to every new discrete distribution's test case**: The two-sided check (`cdf(q(p)) >= p AND cdf(q(p)-1) < p`) is the minimal spec for the infimum quantile. `qGalois` alone does not catch off-by-one errors — it checks sign consistency, not absolute roundtrip accuracy.

## Related Solutions

- [`solutions/testing/2026-05-16-0653-galois-inequality-ulp-guard.md`](../testing/2026-05-16-0653-galois-inequality-ulp-guard.md) — ULP-guard in `qGalois` to avoid false failures from floating-point noise at steep CDF boundaries; the quantile roundtrip check uses the same deterministic GOLDEN-offset grid convention.

## Key Insight

For discrete quantile functions derived from algebraic inverses, `Math.ceil(expr) - 1` must replace `Math.floor(expr)` — they agree for irrational results but `floor` erroneously returns `k + 1` when the argument is exactly the integer `k + 1`, which happens whenever the input probability `p` exactly coincides with a CDF step value.
