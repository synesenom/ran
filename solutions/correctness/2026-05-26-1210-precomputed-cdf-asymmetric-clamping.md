---
date: 2026-05-26T12:10:00Z
category: "correctness"
problem: "PreComputed._cdf cache-hit path returns raw CDF > 1.0 while freshly-computed path clamps"
status: complete
related_issue: "#397"
related_plan: "thoughts/plans/2026-05-26-1205-issue-397-conway-maxwell-poisson.md"
tags: [pre-computed, cdf, clamping, floating-point, monotonicity, discrete]
---

# Solution: PreComputed CDF Asymmetric Clamping

**Date**: 2026-05-26T12:10:00Z
**Category**: correctness
**Related Issue**: #397 (discovered during ConwayMaxwellPoisson implementation)

## Problem

`cdf(k) > 1.0` for large `k` in distributions that extend `PreComputed`, even though only the final tail values are affected. The value exceeds 1 by 1 ULP (e.g. `1.0000000000000002`), breaking the CDF monotonicity invariant: `cdf(k) > cdf(k+1)` when `k+1` is the first index that returns exactly `1.0`.

## Root Cause

`_pre-computed.js` `_cdf(x)` has two branches:

```js
_cdf (x) {
  if (x < this.cdfTable.length) {
    return this.cdfTable[x]          // ← no clamping
  }
  this._advance(x)
  return Math.min(1, this.cdfTable[x])  // ← clamped
}
```

A running-sum CDF built from float PMFs that sum to 1.0 can accumulate to `1 + 1 ULP` in the tail. The freshly-computed path (`_advance`) clamps this on exit, but **stores the raw value in `cdfTable`**. On the next call for the same `x`, the cache-hit branch returns the raw un-clamped value. The bug is timing-dependent: the first call returns ≤ 1.0 (freshly computed, clamped), but a subsequent call for the same `x` returns the raw stored value `> 1.0`.

The base-class fix is tracked as bug #419.

## Fix

Until bug #419 is resolved in the base class, subclasses whose running-sum CDFs can accumulate past 1.0 should override `_cdf` to clamp on both branches:

```js
_cdf (x) {
  if (x < this.cdfTable.length) {
    return Math.min(1, this.cdfTable[x])
  }
  this._advance(x)
  return Math.min(1, this.cdfTable[x])
}
```

Applied in `src/dist/conway-maxwell-poisson.js` lines 66–72.

## Prevention Strategy

When adding a new `PreComputed` subclass, always override `_cdf` with symmetric clamping on both branches until bug #419 lands. The base-class fix itself is simple: change line 132 in `_pre-computed.js` from `return this.cdfTable[x]` to `return Math.min(1, this.cdfTable[x])`.

To detect this class of bug in testing: include a refVal at a tail `x` with CDF close to 1.0 (e.g. `cdf > 0.9999`). The monotonicity checker in `test/dist.js` will catch any value that exceeds 1.0 when the table grows beyond that index.

## Related Solutions

- `solutions/correctness/2026-05-23-1930-gamma-subclass-q-inheritance-guard.md` — similar pattern: base-class method works for direct instances but subtly misbehaves for subclasses due to an inherited code path; fix was a local override.

## Key Insight

A `Math.min(1, ...)` guard applied only to the freshly-computed branch of a two-branch `_cdf` stores the raw (potentially > 1) value in the shared cache, so every subsequent cache-hit call returns an un-clamped value — both branches must clamp, or the base class must store the clamped value.
