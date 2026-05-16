---
date: 2026-05-16T06:53:00Z
category: "testing"
problem: "Sign-product inequality (x - q) * (cdf(x) - p) >= 0 produces false failures when x ≈ q at machine epsilon for steep-CDF distributions"
status: complete
related_issue: "#104"
related_plan: "thoughts/plans/2026-05-16-0602-issue-104-remove-math-random-test-utils.md"
tags: [testing, floating-point, galois-inequality, quantile, ulp, determinism, Math.random]
---

# Solution: Galois inequality ULP guard and deterministic test-point generation

**Date**: 2026-05-16T06:53:00Z
**Category**: testing
**Related Issue**: #104

## Problem

Mathematical property tests in `test/test-utils.js` used `Math.random()` and `d.sample()` inside purely deterministic assertions (PDF non-negativity, CDF monotonicity, the `pdf = d/dx cdf` identity, Galois quantile inequality). Specifically:

- `runX`, `runP`, `cdf2pdf` added `Math.random()` jitter to test-grid points
- `qGalois` called `d.sample()` 10 times to generate x-values for `(x - q(p)) * (cdf(x) - p) >= 0`

The first attempt to fix `qGalois` used quantile evaluations at `p ± delta` for small deltas `[-0.15, -0.05, 0, 0.05, 0.15]`. This caused 50 distributions (BaldingNichols, BetaPrime, and others with steep CDFs) to fail with assertions of the form:

```
cdf(0.4174628320868595) = 0.4472135954799997 and q(0.44721359548000006) = 0.4174628320868591
```

Both sides of the product were sub-machine-epsilon, and the product's sign was pure floating-point noise.

## Root Cause

Two distinct problems:

1. **Grid jitter**: `Math.random()` was used to avoid testing on a perfectly uniform grid — a sound reason to jitter, but implemented non-deterministically.

2. **qGalois x-value generation**: Small p-relative deltas (e.g. `p - 0.05`) return nearly identical x-values when the distribution's CDF is steep (quantile is flat). For BaldingNichols at `p ≈ 0.447`, the quantile function maps both `p` and `p - 0.05` to x-values differing by only 4e-16 (within a few ULPs). Then `cdf(x) - p` is also sub-epsilon. The product `(x - q) * (cdf(x) - p)` is the product of two noise-level quantities whose individual signs are determined by floating-point rounding in two independent code paths (Brent root-finding and the regularized beta function). The product can be negative even though the Galois inequality holds mathematically.

## Fix

**Grid jitter** (`runX`, `runP`, `cdf2pdf`): replaced `Math.random()` with `(i * GOLDEN) % 1` where `GOLDEN = 0.6180339887` (the golden-ratio conjugate, φ − 1). This is a low-discrepancy deterministic sequence that distributes points quasi-uniformly within each grid cell without periodicity.

**`qGalois`**: replaced the 10 `d.sample()` calls with a fixed set of reference probabilities `GALOIS_PROBS = [0.1, 0.25, 0.5, 0.75, 0.9]`, then added a ULP-magnitude guard:

```js
const dx = x - q
if (Math.abs(dx) < 4 * Number.EPSILON * (Math.abs(x) + Math.abs(q) + 1)) {
  continue
}
assert(dx * dp >= 0, ...)
```

The guard skips exactly the regime where `x` and `q` are numerically indistinguishable — at that scale, the sign of `dp` is determined by floating-point rounding noise, not by a real violation. When `dx` is at the ULP level, the inequality cannot be meaningfully tested and the skip is correct. Real violations have `|dx|` many orders of magnitude larger than the tolerance.

## Prevention Strategy

1. **Never use `sample()` or `Math.random()` in mathematical property tests** (monotonicity, non-negativity, identities, inequalities). These are structural properties of the functions themselves, not statistical properties of samples.

2. **For sign-product inequalities `(a - b) * (c - d) >= 0`**: before asserting, check whether `|a - b|` is sub-ULP relative to the operand scale. If so, skip — the product sign is noise, not signal. The guard formula `4 * Number.EPSILON * (|a| + |b| + 1)` is a standard relative-plus-absolute ULP tolerance.

3. **For grid-jitter in deterministic tests**: use the golden-ratio sequence `(i * 0.6180339887) % 1` instead of `Math.random()`. It provides the same low-discrepancy coverage without non-determinism.

4. **Avoid x-values derived from quantiles at probabilities close to the test p**: when the CDF is steep, `q(p ± small_delta) ≈ q(p)` in floating-point. Use fixed reference probabilities (e.g. `[0.1, 0.25, 0.5, 0.75, 0.9]`) that are well-separated from typical test p-values.

## Related Solutions

- `solutions/testing/2026-05-16-ridders-error-estimate-kink-detection.md` — The same pattern (using a convergence error estimate to skip numerically unreliable test points) was applied to the `cdf2pdf` Ridders differentiation step. The ULP guard here is the quantile-space analogue of that Ridders guard.

## Key Insight

When a quantile test checks a sign-product inequality such as `(x - q) * (cdf(x) - p) >= 0`, any pair where `x` and `q` differ by less than a few ULPs must be skipped — for distributions with steep CDFs the quantile function is flat in floating-point, so `x - q` is pure rounding noise and the product sign is meaningless.
