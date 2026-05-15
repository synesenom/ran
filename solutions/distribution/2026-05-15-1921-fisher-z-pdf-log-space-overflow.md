---
date: 2026-05-15T19:21:03Z
category: "distribution"
problem: "FisherZ.pdf(x) returns Infinity for x > ~17.8 at default parameters"
status: complete
related_issue: "#137"
related_plan: "thoughts/plans/2026-05-15-1808-fisher-z-pdf-overflow-fix.md"
tags: [log-space, overflow, fisher-z, change-of-variables, beta, float64, pdf]
---

# Solution: FisherZ pdf log-space overflow

**Date**: 2026-05-15T19:21:03Z
**Category**: distribution
**Related Issue**: #137

## Problem

`FisherZ.pdf(x)` returns `Infinity` for any `x > ~17.8` (e.g., `FisherZ(1, 1).pdf(20) === Infinity`). The distribution has infinite support and the PDF is well-defined and finite for all real `x`, decaying smoothly to zero in both tails.

## Root Cause

`FisherZ._pdf` delegated through a three-level inheritance chain: FisherZ → F → Beta. FisherZ computed `y = exp(2x)` and passed it to `F._pdf`. F computed the Beta argument `d1*y / (d2 + d1*y)`. For `x > ~17.8`, `y = exp(2x) > 1/Number.EPSILON ≈ 4.5e15`, causing the Beta argument to round to exactly `1.0` in float64.

`Beta._pdf` then evaluated `Math.log(1 - 1.0) = Math.log(0) = -Infinity`. With `this.c[2] = beta - 1 = -0.5`, the expression `-0.5 * -Infinity = +Infinity` propagated through `Math.exp(+Infinity)` to return `Infinity`.

The CDF delegation (`super._cdf(exp(2x))`) was immune — `regularizedBetaIncomplete` handles saturation gracefully. Only the PDF path was affected.

## Fix

Override `_pdf` in FisherZ with a direct log-space computation, bypassing the F→Beta delegation chain:

```
log f(z) = log(2) + d1*z + (d1/2)*log(d1) + (d2/2)*log(d2) - logBeta(d1/2, d2/2) - ((d1+d2)/2) * log(d1*exp(2z) + d2)
```

The one potentially-overflowing term `log(d1*exp(2z) + d2)` is stabilized with a branch split:
- `z >= 0`: rewrite as `2z + log(d1 + d2*exp(-2z))` — `exp(-2z)` safely underflows to 0
- `z < 0`: use `log(d2 + d1*exp(2z))` directly — `exp(2z)` is small

The constant `log(2) + (d1/2)*log(d1) + (d2/2)*log(d2) - logBeta(d1/2, d2/2)` is precomputed once in the constructor as `this.c[3]`, reusing `this.c[0] = logBeta(d1/2, d2/2)` already stored by Beta's constructor (indices 0–2 belong to Beta).

A secondary fix in `test/test-utils.js` adds a guard in `cdf2pdf` to skip points where `|df| < PRECISION` — needed because the CDF saturates to 1.0 for `x > ~19` (derivative is exactly 0), but the PDF is still representable (~1e-9), causing false failures.

## Prevention Strategy

When a distribution is defined as a change-of-variables on a parent (e.g., `Z = g(X)`), the Jacobian-chain delegation `_pdf(z) = parent._pdf(g(z)) * |g'(z)|` is only numerically safe when `g(z)` stays well within the parent's support in float64. Whenever `g(z)` can drive the parent's internal argument to a boundary value (0 or 1 for Beta, 0 for Gamma), log-space overflow will occur silently.

**Pattern to adopt**: derive `log f(z)` analytically from the canonical formula and implement it directly in the subclass `_pdf`, using the log-sum-exp branch split for any term of the form `log(a*exp(t) + b)`. Do not trust that the parent's log-space handling will propagate correctly through multi-level change-of-variables delegation at extreme tail values.

**Red flag**: if a distribution's support is unbounded and its `_pdf` delegates to a parent whose support is bounded, audit whether the transformation `g(z)` can saturate at the parent's support boundary in float64.

## Related Solutions

- No directly related past solutions found.

## Key Insight

When a change-of-variables distribution delegates `_pdf` up a chain (FisherZ → F → Beta), float64 precision loss in an intermediate argument silently converts a finite density into `Infinity` at extreme tails — fix by overriding `_pdf` in the subclass with a direct log-space formula and a log-sum-exp branch split, rather than relying on the parent chain to remain stable.
