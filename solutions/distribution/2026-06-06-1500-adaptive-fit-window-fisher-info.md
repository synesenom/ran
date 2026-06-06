---
date: 2026-06-06T15:00:00Z
category: "distribution"
problem: "Fixed ±5 integer window in fit() grid search is too narrow for high-variance MOM seeds (e.g. F(5, 300)) and wastes evaluations when data strongly determines the integer parameter"
status: complete
related_issue: "#663"
related_plan: "thoughts/plans/2026-06-06-1405-fisher-info-fit-window.md"
tags: [fit, integer-parameter, profile-likelihood, grid-search, fisher-information, cramér-rao, adaptive-window]
---

# Solution: Adaptive fit() Integer Grid Window via Observed Fisher Information

**Date**: 2026-06-06T15:00:00Z
**Category**: distribution
**Related Issue**: #663

## Problem

The profile likelihood grid search introduced in #624 used a hardcoded ±5 window around the moment-estimate seed for all nine integer-parameter distributions (`Chi2`, `Chi`, `InverseChi2`, `IrwinHall`, `UniformProduct`, `HeadsMinusTails`, `Soliton`, `Erlang`, `F`). For distributions where the method-of-moments estimator is imprecise, the true MLE integer can lie more than 5 steps from the seed: `F(5, 300)` with a small sample produces MOM amplification > 200, placing the seed 10–30 integers from the MLE.

## Root Cause

The fixed ±5 constant was chosen as a safe default, but it fails in two directions simultaneously:
- **Too narrow**: When the MOM seed is imprecise (high-variance parameters, small samples), the true MLE is outside the search window and the grid returns a suboptimal integer.
- **Rigid**: The window never narrows even when a large sample strongly determines the integer (e.g. 1000 observations of Chi2(3)), wasting 10 likelihood evaluations when 1 would suffice.

## Fix

Added `Distribution._adaptiveHalfWidth(lnLAt, seed, lb)` to the base class. It computes the observed Fisher information at the seed via a finite-difference second derivative of the total log-likelihood:

```
I_obs = 2·lnL(seed) − lnL(seed+1) − lnL(seed−1)
w     = max(5, ⌈3/√I_obs⌉)
```

The `max(5, ...)` floor preserves backward compatibility and guards against flat likelihoods (where `I_obs ≈ 0` would produce `w → ∞`). `max(I_obs, 1e-6)` inside the sqrt prevents division by zero. When `seed − 1 < lb`, the backward point is unavailable; `lnL(seed)` is reused, collapsing to a one-sided difference that still respects the floor.

This approach uses only the three log-likelihood evaluations already needed to determine the window width — no new special functions, no trigamma, no analytical derivations per distribution.

Each affected distribution's `static fit()` was updated to call `_adaptiveHalfWidth` instead of using the literal `5`:

```js
const w = Distribution._adaptiveHalfWidth(
  k => { try { return new Cls(k).lnL(data) } catch (_) { return -Infinity } },
  kSeed, 1
)
const kLo = Math.max(1, kSeed - w)
const kHi = kSeed + w
```

The `F` distribution uses two independent calls, one per axis, each profiled at the other parameter's seed.

## Prevention Strategy

When implementing a profile likelihood grid search for an integer parameter, never hard-code the half-width as a constant. Always call `Distribution._adaptiveHalfWidth` — it costs 3 extra likelihood evaluations and prevents silent failures when moment estimates are imprecise. The floor of 5 guarantees no regression versus the old fixed window.

## Related Solutions

- [`solutions/distribution/2026-06-03-1130-integer-param-fit-profile-grid-search.md`](../distribution/2026-06-03-1130-integer-param-fit-profile-grid-search.md) — Prior solution that introduced the fixed ±5 profile grid search for integer parameters; this solution replaces the fixed constant with an adaptive window

## Key Insight

The observed Fisher information (`I_obs = 2·lnL(k) − lnL(k+1) − lnL(k−1)`) produces a data-adaptive Cramér-Rao window `max(5, ceil(3/sqrt(I_obs)))` that automatically widens when the moment-estimator seed is imprecise — use this instead of any fixed half-width constant.
