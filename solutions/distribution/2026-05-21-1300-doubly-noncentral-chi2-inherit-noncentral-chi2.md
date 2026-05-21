---
date: 2026-05-21T13:00:00Z
category: "distribution"
problem: "DoublyNoncentralChi2 duplicated ~25 lines of NoncentralChi2 _pdf/_cdf instead of inheriting"
status: complete
related_issue: "#316"
related_plan: "thoughts/plans/2026-05-21-1229-doubly-noncentral-chi2-inherit-noncentral-chi2.md"
tags: [doubly-noncentral-chi2, noncentral-chi2, inheritance, constructor-only-subclass, reproductive-property, lambda-zero-guard, validator-relaxation, deferred-inheritance, parameter-collapse, erlang-pattern]
---

# Solution: DoublyNoncentralChi2 inherits NoncentralChi2

**Date**: 2026-05-21T13:00:00Z
**Category**: distribution
**Related Issue**: #316

## Problem

`DoublyNoncentralChi2(k1, k2, λ1, λ2)` was implemented as a standalone class extending `Distribution`, duplicating the full `_pdf`, `_cdf`, and `_generator` implementations from `NoncentralChi2` (~25 lines). This was dead weight — the two distributions are mathematically identical via the reproductive property of noncentral chi-squared: `DNCχ²(k1, k2, λ1, λ2) ≡ NCχ²(k1+k2, λ1+λ2)`.

## Root Cause

`NoncentralChi2` originally validated `lambda > 0`, which excluded the `lambda = 0` case (central chi-squared degenerate). `DoublyNoncentralChi2` needed to handle `lambda1 = lambda2 = 0` (both non-centralities zero), so it could not inherit from a parent that rejected `lambda = 0`. Rather than fixing the parent first, the implementation duplicated the parent's logic and added the `lambda = 0` branch inline. The constraint relaxation was deferred indefinitely.

## Fix

Two coupled changes implemented together:

1. **Relaxed `NoncentralChi2` validator** from `lambda > 0` to `lambda >= 0`, and added a `lambda === 0` guard in `_pdf` that falls back to the central chi-squared formula (since the Bessel form divides by `lambda` and is undefined at zero):
   ```js
   if (this.p.lambda === 0) {
     if (this.p.k === 2 && x === 0) { return 0.5 }  // 0*log(0) = NaN without guard
     return Math.exp(
       (this.p.k / 2 - 1) * Math.log(x) - x / 2 -
       (this.p.k / 2) * Math.LN2 - logGamma(this.p.k / 2)
     )
   }
   ```

2. **Rewrote `DoublyNoncentralChi2`** as a constructor-only subclass of `NoncentralChi2`, following the `Erlang extends Gamma` / `Gilbrat extends LogNormal` precedent:
   ```js
   export default class extends NoncentralChi2 {
     constructor (k1, k2, lambda1, lambda2) {
       const k1i = Math.round(k1); const k2i = Math.round(k2)
       super(k1i + k2i, lambda1 + lambda2)           // collapse to equivalent NCχ²
       this.p = Object.assign(this.p, { k1: k1i, k2: k2i, lambda1, lambda2 })
       Distribution.validate({ k1: k1i, k2: k2i, lambda1, lambda2 }, [...])
     }
   }
   ```
   All `_pdf`, `_cdf`, `_generator` methods deleted — fully inherited.

Net result: ~-50 lines of production code, with correctness guaranteed by the collapsed-parameter equivalence.

## Prevention Strategy

When a subclass stores collapsed parameters in `this.c` and then reimplements the parent's `_pdf`/`_cdf` verbatim, that is a sign of deferred subclassing. The pattern to check for: if `DistA(a, b)` is provably equivalent to `DistB(f(a,b), g(a,b))`, the correct design is a constructor-only subclass. When inheritance is blocked by a parent validator constraint that is *too strict*, fix the parent constraint first (as a prerequisite issue) rather than duplicating code in the child.

## Related Solutions

- [solutions/distribution/2026-05-20-1838-doubly-noncentral-chi2-additivity-collapse.md](../distribution/2026-05-20-1838-doubly-noncentral-chi2-additivity-collapse.md) — Mathematical proof that DNCχ² collapses to NCχ² via the Poisson mixture structure.

## Key Insight

When a distribution stores its parameters as a collapsed equivalent of a parent distribution and then reimplements the parent's `_pdf`/`_cdf` verbatim, that is a deferred subclassing decision waiting to be completed — fix the parent's over-restrictive constraint instead of duplicating code in the child.
