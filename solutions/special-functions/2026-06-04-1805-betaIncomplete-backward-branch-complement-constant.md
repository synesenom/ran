---
date: 2026-06-04T18:05:44Z
category: "special-functions"
problem: "betaIncomplete backward branch used normalization constant 1 instead of B(a,b), producing factor-of-17 errors"
status: complete
related_issue: "#675"
related_plan: "thoughts/plans/2026-06-04-1727-betaIncomplete-backward-branch-fix.md"
tags: [beta-incomplete, complement-identity, normalization, backward-branch, continued-fraction, regularized-vs-unnormalized]
---

# Solution: betaIncomplete backward-branch complement constant

**Date**: 2026-06-04T18:05:44Z
**Category**: special-functions
**Related Issue**: #675

## Problem

`betaIncomplete(a, b, x)` silently returned wrong values whenever the backward
continued-fraction branch was taken (i.e. `x >= (a+1)/(a+b+2)` and `b != 0`).
For example, `betaIncomplete(2, 3, 0.5)` returned ~0.974 instead of the correct
~0.0573 — a factor-of-17 error. No exception was raised; the result was
numerically plausible (near 1), and all existing precision tests happened to
use only forward-branch inputs, so the bug was invisible to the test suite.

## Root Cause

`betaIncomplete` (unnormalized `B(a,b,x)`) and `regularizedBetaIncomplete`
(normalized `I_x(a,b) = B(a,b,x)/B(a,b)`) share the same `_biContinuedFraction`
helper but their `bt` prefactors carry different normalizations:

- **Regularized**: `bt = exp(logGamma(a+b) - logGamma(a) - logGamma(b) + a·log x + b·log(1-x))`  
  → `bt` folds in `1/B(a,b)`, so backward branch `1 - bt·CF/b = 1 - I_{1-x}(b,a) = I_x(a,b)` ✓

- **Unnormalized**: `bt = exp(a·log x + b·log(1-x))`  
  → `bt` has no `1/B(a,b)` factor, so the complement identity requires  
  `B(a,b) - bt·CF/b` (not `1 - bt·CF/b`)

The code used `1` in both functions. This is accidentally correct for the
regularized variant but produces `1 - B(b,a,1-x)` instead of
`B(a,b) - B(b,a,1-x)` for the unnormalized variant.

## Fix

Replace the literal `1` with `Math.exp(logGamma(a) + logGamma(b) - logGamma(a+b))`
on the backward-branch return line of `betaIncomplete`
(`src/special/beta-incomplete.js:60`). `logGamma` was already imported at line 2
so no new dependency was needed. The regularized sibling is left unchanged.

A backward-branch precision test (`betaIncomplete(2, 3, 0.5)`, exact rational
reference `11/192 ≈ 0.05729166...`) was added to `test/precision.js` to make
any future regression immediately visible. The stale comment marking the backward
branch as known-broken was removed.

## Prevention Strategy

1. **Verify complement constants branch-by-branch.** When two sibling functions
   (unnormalized and regularized) share a continued-fraction helper and a backward
   branch, confirm each uses the correct leading constant: `B(a,b)` for the
   unnormalized form, `1` for the regularized form.

2. **Cover every branch in precision tests.** A `describe` block for a piecewise
   special function must contain at least one test input from each branch. A
   comment flagging a branch as untested is not a substitute for an actual test —
   "documented known bug" is not a safe steady state.

3. **Watch for plausible-looking wrong values.** The buggy return value was near 1,
   which looks reasonable for a CDF-adjacent function. Silent errors close to 1 or
   0 are harder to catch than NaN/Infinity — unit test all branches explicitly.

## Related Solutions

- `solutions/correctness/2026-05-18-1133-inverse-chi2-cdf-complementary-gamma.md` — Similar pattern: double subtraction-from-1 in complement chains; audit rule: never form `1 - regularized(...)` manually when a direct complementary export exists.
- `solutions/special-functions/2026-05-17-1540-erfc-crossover-cancellation.md` — Paired `f` / `1-f` function exports to avoid stacked complement subtractions.
- `solutions/testing/2026-05-22-1708-refvals-self-validation-cancellation-boundary.md` — Rule: use independent high-precision reference values (mpmath) for precision tests, not the implementation itself.

## Key Insight

When an unnormalized and a regularized special function share a continued-fraction
helper, the backward-branch complement constant is `B(a,b)` in the unnormalized
case and `1` in the regularized case — using `1` in both produces a silently
wrong result that is numerically plausible and undetectable without a precision
test that explicitly exercises the backward branch.
