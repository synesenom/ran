---
date: 2026-06-01T02:10:00Z
category: "algorithm"
problem: "Brent root-finder had unfaithful pseudocode, faulty tolerance near zero, and silent NaN on bad brackets; bracket guard fa*fb>=0 throws on exact root at endpoint"
status: complete
related_issue: "#541"
related_plan: "thoughts/plans/2026-06-01-0200-chandrupatla-replace-brent.md"
tags: [root-finding, chandrupatla, brent, tolerance, bracket-guard, numerical-stability, exact-root]
---

# Solution: Chandrupatla bracket guard and Brent defects

**Date**: 2026-06-01T02:10:00Z
**Category**: algorithm
**Related Issue**: #541

## Problem

`src/algorithms/brent.js` had three compounding defects. First, a self-acknowledged
`// TODO Use pseudo code from wikipedia.` comment confirmed the state-machine variable `e` did
not faithfully implement Brent's algorithm. Second, the convergence tolerance
`EPS * (2 * Math.abs(b) + 0.5)` used an arbitrary absolute floor of `0.5` instead of `1`, and
compared against the half-bracket `xm` with coefficient 2, making the effective relative tolerance
4× looser than the standard criterion and failing near zero. Third, when the caller supplied a
non-bracketing interval (same-sign endpoints), the function silently returned `NaN` instead of
throwing — violating the project's ADR-0015 error convention.

During implementation a fourth defect was caught: the bracket guard `fa * fb >= 0` throws when
either endpoint is an exact root (`f(a) = 0`), because `0 * x = 0 >= 0` is true. This would
cause `TukeyLambda._cdf(1/lambda)` (the support boundary) to throw instead of returning `1`.

## Root Cause

The `brent.js` implementation was an informal pseudocode transcription, not a faithful algorithm.
The tolerance `EPS * (2*|b| + 0.5)` is not the canonical mixed absolute/relative criterion; the
correct floor is `max(|x|, 1)` scaled by `EPS`, not `0.5`. The silent-`NaN` path for bad brackets
predates ADR-0015. A secondary latent bug in the initial swap condition —
`Math.abs(fb) > Math.abs(fc)` where `fc === fb` at that point — meant the condition was always
false (dead code) and the algorithm never started from the better bracket endpoint.

## Fix

Replaced `brent.js` with Chandrupatla (1997), a ~30-line hybrid bisection/IQI algorithm
(vs ~100+ for TOMS 748) that achieves equivalent practical convergence on smooth CDFs.

The bracket guard was implemented with explicit early-returns **before** the sign check:

```js
if (fa === 0) return a0
if (fb === 0) return b0
if (fa * fb > 0) {
  throw Error('chandrupatla: f(a) and f(b) must have opposite signs')
}
```

This ordering is load-bearing: the `>= 0` form incorrectly throws for exact endpoint roots.
The initial swap was fixed to compare `Math.abs(fb2) > Math.abs(fc)` where `fb2` and `fc`
are the actual distinct function values, not the post-assignment originals.

The convergence criterion was set to `|c - b| <= 2 * EPS * max(|b|, 1)` per the paper.

## Prevention Strategy

1. **Cite the reference in JSDoc and verify the convergence criterion.** The formula
   `EPS * (2*|x| + 0.5)` is a red flag — the canonical criterion is always
   `EPS * max(|x|, 1)`.
2. **Never use `fa * fb >= 0` as a bracket guard** when exact-root endpoints are possible.
   Always emit `if (fa === 0) return a0` / `if (fb === 0) return b0` early-returns before the
   strict `> 0` throw.
3. **Do not suppress bracket failures with `NaN`.** Per ADR-0015, a non-bracketing interval is
   a caller/programming error and must throw. Silent `NaN` through `Math.min`/`Math.max` masks
   the defect entirely.
4. **When initializing a multi-point algorithm from two inputs, double-check that the swap
   condition compares the post-assignment variables.** If `c` is assigned from the same
   expression as `fc`, comparing them is comparing identical values.

## Related Solutions

- `solutions/algorithm/2026-05-20-0647-q-estimate-walk-infinite-support-discrete.md` — quantile
  estimation edge cases in discrete distributions (related quantile infrastructure)

## Key Insight

The bracket guard `fa * fb >= 0` is semantically wrong when exact roots at endpoints are
possible — use explicit `if (fa === 0) return a0` early-returns followed by the strict
`fa * fb > 0` throw; otherwise a valid call whose endpoint is a root throws instead of returning.
