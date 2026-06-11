---
date: 2026-06-11T13:45:46Z
category: "correctness"
problem: "Re-parametrizing subclasses silently inherit mathematically wrong moment overrides when their parent gains analytical moments"
status: complete
related_issue: "#581"
related_plan: "thoughts/plans/2026-06-11-0930-issue-581-analytical-moments-f-t-noncentral.md"
tags: [moments, inheritance, shadowing, reparametrization, noncentral, F, StudentZ, TDD, prototype-chain]
---

# Solution: Moment-override inheritance shadowing in re-parametrizing distribution subclasses

**Date**: 2026-06-11T13:45:46Z
**Category**: correctness
**Related Issue**: #581

## Problem

When `NoncentralChi2` gained analytical `mean()`/`variance()`/`skewness()`/`kurtosis()` overrides (#581), its child `NoncentralChi` silently inherited them — returning the chi-*squared* moments (mean `k + lambda`, with the wrong lambda semantics on top: `NoncentralChi.p.lambda` is the chi noncentrality, the parent's polynomial expects the chi-squared noncentrality `lambda²`) instead of the chi moments, which need ₁F₁-based odd raw moments. Identically, when `Beta` gained moments in #575, `F extends Beta` silently inherited `Beta(d1/2, d2/2)`'s moments — `F(5, 11).mean()` returned `d1/(d1+d2) = 0.3125` instead of `d2/(d2−2) = 11/9`. Neither regression surfaced anywhere except the TDD `moments` test entries written *before* the implementation: the RED step showed `NoncentralChi(4, 2) mean = 6, expected 2.6945…` and the F rows failing against Beta's values.

Four of the eight distributions in #581 sit in such chains: `F extends Beta`, `StudentZ extends StudentT`, `NoncentralChi extends NoncentralChi2`, `NoncentralF extends NoncentralBeta`.

## Root Cause

JavaScript prototype inheritance is unconditional — a method added to a parent is immediately live on every subclass. Re-parametrizing subclasses (those that call `super()` with transformed arguments and/or replace `this.p` after `super()`) are structural inheritance traps for three reasons:

1. The child's `this.p` carries different keys: `StudentT.mean()` reads `this.p.nu`, but `StudentZ` sets `this.p = { n }`, so the inherited guard `this.p.nu > 1` evaluates `undefined > 1` → always `NaN`.
2. Even with overlapping key names the semantics differ: `NoncentralChi.p.lambda` is the chi noncentrality, while the parent formula expects the chi-squared noncentrality `lambda²` (stored in `this.c.lambda2`).
3. The child is a *transform* of the parent (square root, ratio), so the parent's moment formulas are categorically wrong even with correct parameters — and the numerical fallback that previously executed (and was at least approximately right for finite moments) no longer runs once the parent has overrides.

## Fix

Every child in a re-parametrizing chain received explicit overrides shadowing the parent's, each derived for the child's own variate: `F` and `NoncentralF` closed forms in `{d1, d2, lambda}` with `+Infinity` below the d2 > 2/4/6/8 thresholds; `StudentZ` t-formulas shifted to `n` (variance `1/(n−3)`); `NoncentralChi` odd raw moments via Kummer-transformed ₁F₁ (`₁F₁(a; b; −h) = e^(−h)·₁F₁(b−a; b; h)`, all-positive series). A WHY comment at each child's moment block states what it shadows and why the parent's values would be wrong.

## Prevention Strategy

Before merging any PR that adds a public method override (`mean`, `variance`, `skewness`, `kurtosis`, `_q`, `_fitInit`, …) to a distribution class, run:

```bash
grep -rn "extends <ClassName>" src/dist/
```

For every subclass found, either (a) it already overrides the same method, or (b) prove the parent's formula is still correct under the child's `this.p`/`this.c` layout — re-parametrizing subclasses never satisfy (b). The reliable detection mechanism is TDD `moments` coverage: a `moments` entry for every threshold band of every *child* makes the RED step expose wrong inheritance immediately. Without RED-first tests, the wrong values are silent because moment methods have no other consumers in the test suite.

## Related Solutions

- `solutions/correctness/2026-05-28-1851-reparametrizing-subclass-inherits-wrong-fitinit.md` — same hazard for `static _fitInit` (`F`, `R`, `BaldingNichols` inheriting `Beta._fitInit`).
- `solutions/correctness/2026-05-23-1930-gamma-subclass-q-inheritance-guard.md` — `Gamma._q` inherited by five transform-subclasses; opt-out via `this._q = undefined`.
- `solutions/correctness/2026-05-18-0534-fisher-z-double-halving-subclass-delegation.md` — `FisherZ extends F` double-halving degrees of freedom through constructor delegation.
- `solutions/distribution/2026-06-07-2138-continuous-subclass-natural-params.md` — `this.p` replacement breaking parent methods that read parent keys (the same mechanism that forces `StudentZ` to shadow).

## Key Insight

When a parent distribution gains analytical moment overrides, every re-parametrizing subclass silently inherits mathematically wrong formulas (and the previously-running numerical fallback stops masking it) — grep `extends <ClassName>` and shadow or verify each child, with RED-first `moments` tests per child as the enforcement mechanism.
