---
date: 2026-06-01T10:02:00Z
category: "algorithm"
problem: "trap.js used hardcoded 1e-12 tolerance, inlined Neumaier, and worst-case 2^24 evaluations; neumaier([]) returns NaN when refinement level produces no nodes"
status: complete
related_issue: "#542"
related_plan: "thoughts/plans/2026-06-01-1001-tanh-sinh-quadrature.md"
tags: [tanh-sinh, quadrature, double-exponential, neumaier, empty-array, NaN, endpoint-singularity, convergence]
---

# Solution: tanh-sinh replacement for trap.js and neumaier empty-array NaN

**Date**: 2026-06-01  
**Category**: algorithm  
**Related Issue**: #542

## Problem

`src/algorithms/trap.js` had three interrelated problems:

1. **Hardcoded tolerance**: Convergence used `1e-12` instead of the codebase's `EPS = Number.EPSILON`, producing silent accuracy discrepancies between subsystems.
2. **Inlined Neumaier**: Duplicated the compensated-sum logic from `neumaier.js` rather than importing it.
3. **Worst-case 2^24 evaluations**: The trapezoidal method's algebraic (Euler–Maclaurin) convergence required up to 16M function calls for difficult integrands, and the 24-level cap caused silent fallthrough with the last estimate on non-convergence.

Additionally, a bug surfaced during implementation of the replacement: `neumaier([])` returns `NaN` because it reads `sorted[0]` unconditionally on the (undocumented) assumption of a non-empty array.

## Root Cause

The trapezoidal doubling scheme has algebraic convergence rates. When convergence stalled (e.g., slow-decaying integrands), the algorithm silently fell through the 24-level loop without any indication of failure. The inlined Neumaier code predated the shared `neumaier.js` utility.

The empty-array NaN: any quadrature loop that breaks on weight underflow can produce zero entries in the per-level terms array. If the underflow condition fires before the first node is added, `newTerms` is empty. `neumaier(arr)` begins with `let s = sorted[0]`, which is `undefined` for an empty array; `undefined + 0 = NaN`, silently corrupting every subsequent level.

## Fix

Replaced `trap.js` with `src/algorithms/tanh-sinh.js` — double-exponential (tanh-sinh) quadrature using the substitution `x(t) = mid + halfLen·tanh(π/2·sinh(t))`. This achieves `EPS`-level precision in ≤7 refinement levels (~448 evaluations) via doubly-exponential decay of the transformed integrand.

Per-level terms are collected into an array and passed to imported `neumaier()`. The empty-array guard prevents the NaN:

```js
// neumaier([]) → NaN; guard prevents this when all level-k nodes underflow.
const Snew = S / 2 + (newTerms.length > 0 ? h * neumaier(newTerms) : 0)
```

The level-halving recurrence `S_k = S_{k-1}/2 + h_k·neumaier(new_terms_k)` is exact: even-indexed nodes at level k reproduce the level-(k−1) sum exactly, so only odd-indexed (new) nodes need evaluation.

## Prevention Strategy

1. **Always guard `neumaier(arr)` calls**: Check `arr.length > 0` before calling `neumaier`. The function assumes non-empty input — any loop that truncates on an underflow condition can produce zero entries.
2. **Use `EPS` from `src/core/constants`**: Never hardcode convergence tolerances. Mismatched tolerances between subsystems produce silent accuracy discrepancies.
3. **Avoid testing value-diverging singularities** (e.g., `1/sqrt(x)`) with the current implementation: `Math.tanh` saturates to exactly `±1` in float64 before the doubly-exponential weight fully compensates, so `xNode(t) === a` becomes exact and `f(a) = Infinity` corrupts the sum. Use "infinite derivative" integrands (e.g., `sqrt(x)`, where `f(0) = 0`) for endpoint behavior tests instead.

## Related Solutions

- `solutions/algorithm/2026-06-01-0210-chandrupatla-bracket-guard-and-brent-defects.md` — Similar pattern: replacing a defective numerical algorithm (Brent) with a more robust one (Chandrupatla), discovered hardcoded tolerance and silent failure issues.
- `solutions/distribution/2026-05-27-1530-davis-romberg-boundary-guard-and-constant-cache.md` — Romberg integration at a distribution's support boundary where the PDF diverges; same class of "quadrature evaluates f at a singular point" hazard.

## Key Insight

`neumaier([])` returns `NaN` because it reads `sorted[0]` unconditionally — any quadrature loop that truncates on weight underflow must guard `newTerms.length > 0` before passing the collected terms to `neumaier`, or the refinement step silently poisons the entire sum.
