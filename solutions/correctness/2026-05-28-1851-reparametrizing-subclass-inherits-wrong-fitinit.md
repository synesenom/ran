---
date: 2026-05-28T18:51:00Z
category: "correctness"
problem: "Re-parametrizing Beta subclasses silently inherited Beta._fitInit, returning a parameter vector with the wrong arity/domain that made .fit() throw or misconverge"
status: complete
related_issue: "#441"
related_plan: "thoughts/plans/2026-05-28-1749-fitinit-bugfix-batch.md"
tags: [fit, _fitInit, nelder-mead, subclass-inheritance, static-method, beta, reparametrization, method-of-moments, silent-bug]
---

# Solution: Re-parametrizing subclasses inherit the wrong `_fitInit`

**Date**: 2026-05-28T18:51:00Z
**Category**: correctness
**Related Issue**: #441

## Problem

`R.fit()`, `F.fit()`, `FisherZ.fit()`, and `BaldingNichols.fit()` were broken — they
either threw on construction or converged to nonsense. All four extend `Beta`. None had a
`.fit()` recovery test, so the breakage was invisible until issue #441 added `_fitInit`
overrides across the library.

- `R` (constructor `(c)`): inherited a 2-element `[alpha, beta]` vector — **wrong arity**.
- `F` / `FisherZ` (constructors `(d1, d2)`): inherited `[alpha=0, beta=0]` for typical data
  → constructor **threw** (`alpha > 0` violated).
- `BaldingNichols` (constructor `(F, p)`, both required in `(0,1)`): inherited `[alpha, beta]`
  values often ≫ 1 → constructor **threw** (`F < 1` violated).

## Root Cause

`_fitInit` is a `static` method on the `Distribution` base class. The base default is a
data-agnostic random-retry probe; subclasses override it with a method-of-moments seed.
`Beta` overrides it to return `[alpha, beta]` (Beta's constructor signature).

When a class extends `Beta` **without its own `_fitInit`**, JavaScript static-method
inheritance resolves the call to the *nearest ancestor* — `Beta._fitInit` — **not** the
base-class fallback. The inherited vector is calibrated to Beta's `(alpha, beta)` signature,
which is semantically wrong for any class that re-parametrizes Beta: different arity (`R`),
different parameter domain (`BaldingNichols` needs `(0,1)`), or different meaning (`F`'s
degrees of freedom). `fit()` then feeds that vector straight into the child constructor
(`new Cls(...x0)`), which throws or starts Nelder-Mead from a meaningless point.

This is the same family of hazard as the earlier Fisher-Z double-halving delegation bug —
re-parametrizing subclasses silently picking up a parent method whose contract assumes the
parent's parametrization.

## Fix

Each re-parametrizing child got a `static _fitInit(data)` returning **its own** constructor's
parameters in order, via method-of-moments on that distribution's moment formulas:

- `R`: `Var[X] = 1/(c+1)` on `[-1,1]` ⇒ `c = 1/Var − 1`, clamped `> 0`.
- `BaldingNichols`: `p = mean`, `F = Var/(p(1−p))`, both clamped into `(1e-3, 1−1e-3)`.
- `F`: `d2 = 2·mean/(mean−1)` (clamped `> 4.1`), then `d1` from the F variance formula with a
  denominator-sign guard.
- `FisherZ`: delegate to `super._fitInit` (= `F._fitInit`) on the back-transformed data
  `exp(2x)` (exponent clamped to 700 to avoid overflow → `NaN`).

Recovery tests now exercise `.fit()` for all four (plus direct `_fitInit` assertions for the
1-parameter cases). A related but distinct usability gap surfaced during the fix — that
`BaldingNichols` never stores its own `F`/`p` in `this.p` — was filed separately as #490
rather than scope-crept into this PR.

## Prevention Strategy

- **When adding `static _fitInit` to any parent distribution** (`Beta`, `Gamma`, `Normal`, …),
  immediately enumerate its subclasses and confirm each either has its own override or
  legitimately shares the parent's exact constructor signature **and** parameter domain. A
  re-parametrizing child must always carry an explicit override (even a one-line delegation
  with a transform, like `FisherZ`).
- **The RED test for a 1-parameter distribution must assert `_fitInit` directly** (returned
  vector length and that the value is data-derived), not just that `.fit()` converges — 1-D
  Nelder-Mead converges from almost any seed and will mask a wrong inherited init. A `.fit()`
  recovery test is only a meaningful RED check for multi-parameter or constraint-throwing
  cases.
- Treat "subclass extends a class that has a domain-specific static hook" as a review checklist
  item for the whole `_fitInit` / `_pdf` / `_cdf` / `_generator` override family.

## Related Solutions

- `solutions/correctness/2026-05-18-0534-fisher-z-double-halving-subclass-delegation.md` —
  same root family: a re-parametrizing subclass silently mis-delegating to a parent method
  whose contract assumed the parent's parametrization.

## Key Insight

A `static` hook on a parent distribution (like `Beta._fitInit`) is a silent correctness trap
for every re-parametrizing subclass: static-method inheritance hands the child the *parent's*
parameter vector, which can throw or misdirect the optimizer — so every re-parametrizing child
needs its own override, and the test must assert the init vector's arity/domain directly.
