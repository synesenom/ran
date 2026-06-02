---
date: 2026-06-02T11:30:00Z
category: "algorithm"
problem: "CRZ alternating-series accelerator had a hidden unsigned-terms interface, fixed n=30 budget, and no monotone-series support; replacement revealed two tableau-corruption failure modes"
status: complete
related_issue: "#545"
related_plan: "thoughts/plans/2026-06-02-0010-wynn-epsilon-algorithm.md"
tags: [wynn-epsilon, series-acceleration, tableau, near-zero-denominator, estimateSet, sign-convention, doubly-noncentral-t, riemann-zeta]
---

# Solution: Wynn Epsilon Replacement of CRZ Accelerated Sum

**Date**: 2026-06-02
**Category**: algorithm
**Related Issue**: #545

## Problem

`src/algorithms/accelerated-sum.js` implemented the Cohen-Rodriguez-Zagier (CRZ) alternating-series accelerator with two hard limitations:

1. **Alternating-series only** — signs were applied internally via Chebyshev weights, so callers passed unsigned (absolute-value) terms and relied on a hidden sign-application contract. The algorithm could not accelerate monotone series.
2. **Fixed 30-term budget** — the hardcoded `n = 30` loop ran regardless of convergence; no dynamic stopping.

Both callers (`riemann-zeta.js` and `doubly-noncentral-t.js`) passed unsigned terms. When replacing with a general-purpose algorithm, the hidden contract had to be made explicit at every call site.

## Root Cause

CRZ is bespoke for alternating series. Its interface forced callers to suppress the sign information in their series terms, which is fine as long as the algorithm is the only consumer — but makes any replacement that builds partial sums directly (like Wynn epsilon) require call-site surgery. The 30-term cap was a magic number that under-converges for slowly alternating series and over-iterates for fast ones.

## Fix

Replaced CRZ with Wynn's epsilon sequence transformation (`src/algorithms/wynn-epsilon.js`):

- Builds an in-place growing tableau from partial sums of any convergent series (alternating or monotone).
- Even-diagonal entries ε_{2m}(0) at `e[0]` when `e.length` is odd are the accelerated Padé extrapolants.
- Stops dynamically when successive even-diagonal estimates agree to within `EPS * max(|e[0]|, 1)`.

Both callers were updated to pass **signed** terms:
- `riemann-zeta.js`: `k => Math.pow(-1, k) * Math.pow(k + 1, -s)` (Dirichlet eta η(s))
- `doubly-noncentral-t.js`: `return (i % 2 === 0 ? 1 : -1) * g * f` at both call sites; `Math.abs(z)` at the end of `_pdf` absorbs the global `(-1)^{j0}` factor

**Two implementation bugs found and fixed during development:**

### Bug 1 — DELTA clamping corrupts the tableau

**Initial approach**: guard near-zero denominator by clamping:
```js
e[j-1] = tmp + 1 / (Math.abs(diff) > DELTA ? diff : Math.sign(diff || 1) * DELTA)
```

**Problem**: When a series converges exactly (e.g., geometric series reaches the machine-exact sum after 3 terms), consecutive partial sums become equal, so `diff = 0`. Clamping to `DELTA = 1e-30` injected `1/DELTA = 1e30` into the tableau, corrupting all subsequent entries. `DoublyNoncentralT._pdf(-2)` returned `4.9e31` instead of `~0.006`.

**Fix**: Early return when `|diff| ≤ DELTA` — the series has converged, so return the best available estimate:
```js
if (Math.abs(diff) <= DELTA) {
  return estimateSet ? estimate : S
}
```

### Bug 2 — Early return with unset estimate drops the result

**Problem**: For `j0 = 1`, the DoublyNoncentralT backward sum has exactly one non-zero term (i=0), then zeros. Partial sums: S₀ = dz, S₁ = dz, S₂ = dz. At n=1, `diff = S₁ - S₀ = 0` triggers early return. But `estimate = 0` at this point (no even-diagonal check has run yet), so the function returned `0` instead of `dz`. This silently dropped the entire backward contribution, making `_pdf(-2) ≈ 4×expected`.

**Fix**: Added `estimateSet` boolean flag. Set `true` only after the first odd-length convergence check updates `estimate`. Early return: `return estimateSet ? estimate : S`. When no even-diagonal estimate has been confirmed, fall back to the last accumulated partial sum `S`.

## Prevention Strategy

When replacing a series-acceleration algorithm:

1. **Make the sign convention explicit in the interface JSDoc**: state whether callers must supply signed or unsigned terms. Never let the algorithm own the sign — it hides a contract that breaks on replacement.

2. **Test against series that converge exactly in a small number of terms** (e.g., a geometric series that reaches exact double-precision sum in 3 iterations) before running distribution regression tests. This class of input triggers the near-zero-denominator path and is not covered by typical accuracy tests.

3. **Use a boolean sentinel (`estimateSet`) rather than a sentinel value** (0, `NaN`, or `-Infinity`) to distinguish "no estimate yet" from a legitimate zero estimate. A sentinel value silently corrupts results when the actual series sum equals the sentinel.

4. **After an algorithm swap, verify degenerate callers separately**: series with very few non-zero terms exercise the early-convergence path, which generic regression tests miss because they only exercise the well-conditioned regime.

## Related Solutions

- `solutions/algorithm/2026-06-01-1002-tanh-sinh-neumaier-empty-array-and-trap-replacement.md` — Another algorithm replacement (trap→tanh-sinh); similar pattern of verifying edge cases (empty input, degenerate intervals) during replacement.

## Key Insight

In a Wynn epsilon tableau, a near-zero denominator means the series has already converged — return the current partial sum immediately rather than clamping to a small floor, because clamping injects `1/DELTA ≈ 1e30` into the tableau and corrupts all subsequent entries. Pair this with an `estimateSet` flag so the fallback is the partial sum `S`, not the zero-initialised `estimate`, to avoid silently dropping series that converge before the first even-diagonal check fires.
