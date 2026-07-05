---
date: 2026-07-05T15:30:00Z
category: "special-functions"
problem: "besselK series and besselKnu connection formula both produce wildly wrong results for large x due to exponentially large intermediate values"
status: complete
related_issue: "#809"
related_plan: "thoughts/plans/2026-07-05-1512-bessel-k-second-kind.md"
tags: [bessel, cancellation, asymptotic, series, connection-formula, K-function, exponential-decay]
---

# Solution: Bessel K Second Kind — Two-Level Cancellation Strategy

**Date**: 2026-07-05
**Category**: special-functions
**Related Issue**: #809

## Problem

Both `_K0`/`_K1` and `besselKnu` produced wildly wrong results for moderate-to-large x:

- `K_0(50)` returned −4,980,736 instead of ~3.41e-23 (split-series form)
- `K_{0.5}(50)` returned ~308,831 instead of ~3.42e-23 (connection formula)
- `besselKnu(-2, x)` silently returned K_1(x) instead of K_2(x) (integer-dispatch sign bug)

## Root Cause

Three separate but thematically related causes — all sharing the same underlying pattern: K_ν(x) is O(e^{-x}) but natural formulas route through O(e^x) intermediates.

**1. K_0/K_1 split-form series cancellation.**
The textbook decomposition `K_0(x) = −lnh·I_0(x) + Σ t_k·H_k` has two addends each of magnitude O(I_0(x)) ≈ O(e^x/√(2πx)). Their difference is O(e^{-x}). At x = 50 each term is ~10^21 and the result is ~10^{-23} — a 44-digit cancellation — consuming every guard digit in float64.

**2. Connection-formula cancellation in besselKnu for large x.**
`K_ν(x) = (π/2)·(I_{-ν}(x) − I_ν(x)) / sin(νπ)` computes two quantities of magnitude O(e^x) whose difference is O(e^{-x}), losing 2x/ln(10) decimal digits. At x = 50 this destroys 43 significant figures.

**3. Negative-integer dispatch missing Math.abs.**
The guard `besselK(Math.round(nu), x)` passed a negative integer to `besselK`. The upward recurrence loop `for (let i = 1; i < n; i++)` runs zero iterations when n < 1, so the function returned the k1 seed (K_1) instead of the correct K_{|n|}.

## Fix

**1. Combined-series form for K_0 and K_1 (small x).**
Instead of computing `−lnh·I_0(x)` and `Σ t_k·H_k` separately, fold `lnh` into each summation term: `s.t * (s.h − lnh)`. The difference `H_k − lnh` is small and well-conditioned because `H_k` grows toward `lnh` as k → ∞. This is the DLMF §10.31.2 combined representation — the algebraic grouping ensures the cancellation happens at the level of individual terms (each small) rather than between two large sums.

**2. Asymptotic expansion above a crossover threshold (x > 6).**
A single constant `_X_K_SERIES = 6` governs both: `_K0` and `_K1` call `_KAsymptotic(nu, x)` for x > 6, and `besselKnu` bypasses the connection formula entirely in favour of `_KAsymptotic` for x > 6. The asymptotic expansion `K_ν(x) ~ √(π/(2x))·e^{-x}·Σ a_k(ν)/x^k` directly produces the exponentially small result without ever computing exponentially large intermediates. Optimal truncation (stop when |a_{k+1}| ≥ |a_k|) keeps the error bounded by the first omitted term.

**3. Absolute value before integer dispatch.**
Change `besselK(Math.round(nu), x)` to `besselK(Math.abs(Math.round(nu)), x)`, exploiting the mathematical identity K_{−n}(x) = K_n(x) (K is even in ν).

## Prevention Strategy

When implementing a special function that is exponentially small for large x (K_ν, E_1, erfc, etc.), immediately check whether any intermediate representation involves quantities of exponentially large magnitude. If so, plan for two distinct mitigations:

- **Small x / series regime:** Look for an algebraically combined form in DLMF where the large-magnitude cancellation is handled symbolically inside each sum term, not between accumulated sums. DLMF §10.31.2 provides the combined form for K_0 and K_1.
- **Large x regime:** Switch to a direct asymptotic expansion rather than transforming a formula designed for small x. Document the crossover constant and the digit-loss rate (2x/ln(10) digits for an O(e^x) subtraction) so future reviewers can verify the threshold is adequate.

For integer-dispatch guards in real-order wrappers (`besselKnu`, future analogues), always apply `Math.abs` when the underlying integer function expects non-negative orders, and cover negative-integer inputs explicitly in the test suite.

## Related Solutions

- `solutions/special-functions/2026-05-17-1540-erfc-crossover-cancellation.md` — erfc large-x cancellation: complementary form avoids cancellation in the same way the asymptotic avoids it here
- `solutions/special-functions/2026-06-14-1240-e1-asymptotic-vs-continued-fraction-crossover.md` — E_1 asymptotic crossover: divergent asymptotic series requires optimal truncation, same pattern as `_KAsymptotic`

## Key Insight

When K_ν(x) is O(e^{-x}) and the natural formula routes through O(e^x) intermediates, the remedies are structurally different depending on the regime: for the series use DLMF's algebraically combined form (fold the large constant into each summation term); for the connection formula switch formulas entirely to the asymptotic expansion — both remedies share a single crossover threshold (here x = 6) that can be verified by checking that the series error budget at the threshold is below machine epsilon.
