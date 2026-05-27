---
date: 2026-05-27T12:02:00Z
category: "distribution"
problem: "Categorical subclass with 3 parameters inherited k=2 from parent, silently producing wrong AIC/BIC values"
status: complete
related_issue: "#398"
related_plan: "thoughts/plans/2026-05-27-1201-zipf-mandelbrot.md"
tags: [categorical, aic, bic, this.k, parameter-count, zipf-mandelbrot, subclass]
---

# Solution: Categorical Subclass k Override

**Date**: 2026-05-27T12:02:00Z
**Category**: distribution
**Related Issue**: #398

## Problem

`ZipfMandelbrot` is a 3-parameter distribution (N, s, q) that delegates construction to `Categorical`. Without an explicit override, `this.k` inherits the value `2` hardcoded in `Categorical`'s `super('discrete', 2)` call. As a result:
- `aic()` returns `2 * (2 - lnL)` instead of `2 * (3 - lnL)` — off by exactly 2
- `bic()` returns `log(n) * 2 - 2*lnL` instead of `log(n) * 3 - 2*lnL` — off by `log(n)`

The error was silent: no exception, no test failure, because no test asserted AIC/BIC values. Caught only by a correctness code review.

## Root Cause

`Categorical` calls `super('discrete', 2)` with `k=2` because it represents a two-parameter family (weights array + min). The `Distribution` base class stores that value at `this.k` (line 24 of `_distribution.js`), and `aic()`/`bic()` read it directly. Any subclass that delegates construction to `Categorical` inherits `k=2` regardless of how many named statistical parameters the subclass exposes.

`Zipf` (2 parameters: s, N) also has 2 parameters and got the right answer by coincidence — masking the trap for the entire Categorical-delegation pattern.

## Fix

Added `this.k = 3` immediately after the `super(...)` call in `ZipfMandelbrot`'s constructor, matching the existing precedent in `Delaporte` (which overrides `k` after calling `PreComputed`'s super at line 27).

```js
constructor (N, s, q) {
  const Ni = Math.round(N)
  super(Array.from({ length: Ni }, (d, i) => Math.pow(i + 1 + q, -s)), 1)
  this.k = 3  // Categorical hardcodes k=2; override with actual parameter count
  // ...
}
```

## Prevention Strategy

Every new `Categorical` subclass must include an explicit `this.k = <param_count>` line after `super()` if its parameter count differs from 2. The rule:

> **If you extend `Categorical` (or any class that hardcodes `k` in its `super()` call), you must set `this.k` explicitly after `super()` to match the actual number of statistical parameters.**

Additionally, test case entries for new distributions should include `aicTest` / `bicTest` reference values, or at minimum a comment noting the expected parameter count, so a wrong `k` produces a detectable assertion failure rather than a silent wrong number.

Distributions at risk: any future `Categorical` subclass with 1 parameter (e.g. a single-exponent discrete distribution) or 3+ parameters.

## Related Solutions

- `solutions/testing/2026-05-20-0459-discrete-quantile-ceil-minus-one-pattern.md` — parent class parameter shadowing (`this.p`) is a different but related trap for Categorical subclasses
- `solutions/testing/2026-05-16-1915-alias-table-chi2-df-correction.md` — parameter count issues for Categorical-based distributions in chi² degrees-of-freedom

## Key Insight

`Categorical` hardcodes `k=2` in its `super()` call; any subclass with a parameter count other than 2 must override `this.k` after `super()` — `Zipf` (also 2 params) got the right answer by coincidence and masks this trap for every future Categorical-based distribution.
