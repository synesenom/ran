---
date: 2026-06-09T14:00:00Z
category: "distribution"
problem: "QExponential moment methods silently returned wrong values when written against the public API parameters (q, lambda) instead of the stored GP canonical parameters (xi, sigma), and exact IEEE 754 boundary tests for q-to-xi thresholds fired incorrectly."
status: complete
related_issue: "#574"
related_plan: "thoughts/plans/2026-06-09-1230-exponential-family-moments.md"
tags: [this.p, subclass, reparametrization, inheritance, qexponential, generalized-pareto, ieee754, floating-point, boundary-testing, moments]
---

# Solution: QExponential Parent Params and IEEE 754 Moment Boundaries

**Date**: 2026-06-09T14:00:00Z
**Category**: distribution
**Related Issue**: #574

## Problem

When implementing `mean()`, `variance()`, `skewness()`, and `kurtosis()` for `QExponential`, the natural instinct is to write the formulas in terms of the constructor's declared parameters `q` and `lambda`. But any reference to `this.p.q` or `this.p.lambda` silently returns `undefined`, producing `NaN` for all moments.

A second independent problem emerged in tests: mathematical "threshold" values of `q` (e.g. `q = 1.2` for the xi ≥ 1/4 kurtosis divergence guard, `q = 4/3` for the xi ≥ 1/2 variance guard) do not trigger the guards in IEEE 754 double-precision arithmetic, because `(1.2 − 1) / (2 − 1.2)` evaluates to `0.24999999999999994` — just below `0.25` — so the `if (xi >= 0.25)` check does not fire, and a finite kurtosis value is returned instead of `Infinity`.

## Root Cause

**Parent-owns-`this.p` trap**: `QExponential extends GeneralizedPareto`. Its constructor calls `super(0, 1/(lambda*(2-q)), (q-1)/(2-q))`, which sets `this.p = { mu: 0, sigma: ..., xi: ... }`. `QExponential` never overrides `this.p`, so after construction `this.p` holds only the GP canonical parameters. The public API parameters `q` and `lambda` exist only as local constructor arguments — they are gone once the constructor returns. Any method body that reads `this.p.q` or `this.p.lambda` silently gets `undefined`.

**IEEE 754 non-representability**: The values `q = 1.2` and `q = 4/3` are not exactly representable in binary floating point. Their stored approximations make the reparametrized xi expression land fractionally below the exact mathematical threshold, so `>=` guards do not trigger. This is a specific case of the general rule that equality and tight inequality comparisons against derived floating-point thresholds are unreliable.

## Fix

**For the parametrization issue**: Write all moment methods in terms of `this.p.xi` and `this.p.sigma` (the parent's canonical parameters). Add a comment noting why — the subclass does not own `this.p`:

```js
mean () {
  const xi = this.p.xi   // GP canonical params — QExponential does not own this.p
  if (xi >= 1) return Infinity
  return this.p.sigma / (1 - xi)
}
```

**For the IEEE 754 boundary tests**: Only use `q` values that map to xi thresholds via an expression that is exact in IEEE 754. `q = 1.5` → `xi = 0.5 / 0.5 = 1.0` (exact). `q = 1.25` → `xi = 0.25 / 0.75 ≈ 0.3333...` (not exact, but numerically the same approximation appears on both sides of the comparison). Do **not** add rows for `q = 1.2` or `q = 4/3` with `Infinity` expectations; the guards are mathematically correct but the test input is not an exact representable boundary.

Concrete verification before writing a boundary test:
```js
const q = 1.2
const xi = (q - 1) / (2 - q)
console.log(xi, xi >= 0.25)  // 0.24999999999999994  false — guard won't fire
```

## Prevention Strategy

1. **Before writing any method on a subclass**, check which class owns `this.p` by reading the parent constructor. If the parent calls `super(transformedArgs)` and never sets `this.p` itself, then the grandparent owns `this.p`. The subclass's natural parameters are gone after construction unless explicitly saved to `this.c` or re-stored in `this.p`.

2. **For any divergence guard based on a derived floating-point expression**, verify the guard value is exact in IEEE 754 before writing a test that asserts `Infinity`. Use `console.log(xi, xi >= threshold)` in Node to confirm the comparison fires as expected.

3. **When the exact boundary test is unreliable**, document the expected behavior with a test that uses a value clearly above the threshold (e.g. `q = 1.501` for the xi ≥ 1 guard) rather than an exact boundary that may float below it.

## Related Solutions

- `solutions/distribution/2026-06-07-2138-continuous-subclass-natural-params.md` — the canonical fix when a subclass needs to expose its own `params()` keys; the present pitfall is the inverse case (the subclass correctly *leaves* `this.p` to the parent and writes methods in GP terms).

## Key Insight

When a distribution subclass delegates its entire parametrization to a parent via `super(f(args)...)`, `this.p` contains only the parent's canonical parameters — the subclass constructor arguments are gone after the `super()` call — so all instance methods must be written in terms of the parent's stored parametrization, not the public API parameters. Additionally, do not write IEEE 754 boundary tests for values derived via floating-point arithmetic unless you have confirmed the comparison fires as expected in Node.
