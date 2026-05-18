---
date: 2026-05-18T11:33:33Z
category: "correctness"
problem: "InverseChi2._cdf returned 0 in the lower tail due to a double subtraction-from-1 in the incomplete-gamma chain"
status: complete
related_issue: "#243"
related_plan: "thoughts/plans/2026-05-18-1116-issue-243-inverse-chi2-cdf-cancellation.md"
tags: [catastrophic-cancellation, incomplete-gamma, inverse-chi2, complementary-form, refvals, test-tolerance, boundary-region]
---

# Solution: InverseChi2._cdf complementary gamma form

**Date**: 2026-05-18T11:33:33Z
**Category**: correctness
**Related Issue**: #243

## Problem

`InverseChi2._cdf(x)` returned grossly incorrect values in the lower tail
(small `x`). At `nu=6, x=0.01` the true CDF is `Q(3, 50) ≈ 2.51e-19`, but
the implementation returned exactly `0`. For slightly larger `x` it
returned `≈ 1.11e-16` (one ulp of `1.0`), still six orders of magnitude
off. The bug was silent: the existing test suite had no refVal below
`x=0.05`, and the test framework's absolute tolerance of `1e-9` would have
passed `0` as correct for any expected value below `1e-9`, making the bug
completely undetectable from tests even if a refVal had been present.

## Root Cause

**Two compounding subtractions from 1 in the same call chain.**

`_cdf(x)` was `1 - gammaLowerIncomplete(nu/2, 0.5/x)`. For small `x`, the
argument `0.5/x` is large, which pushes `gammaLowerIncomplete` into its
`x >= s+1` branch — and that branch internally computes
`1 - _gui(s, x)`. So the actual evaluation chain was
`1 - (1 - _gui(...))`. Each subtraction from 1 loses precision when its
operand is close to 1.

In IEEE 754 double, `ulp(1) ≈ 2.22e-16`. Any `Q` value below that
threshold is indistinguishable from `1.0` after the first subtraction
(`1 - tiny → 1.0`), and the second subtraction (`1 - 1.0`) returns `0`.
For `nu=6` this catastrophic regime begins at approximately `x < 0.0125`.

**Test-framework gap compounding the problem.** `checkRefVals` used a flat
absolute tolerance `|actual - expected| < 1e-9`. For any sub-precision
expected value, that inequality is satisfied by any actual at or below
machine epsilon — including the buggy `0`. So the bug could not have been
caught by adding a refVal alone; the framework also had to be tightened.

## Fix

Two coordinated changes — both required.

**1. Production fix** (`src/dist/inverse-chi2.js`):
Replaced `1 - gammaLowerIncomplete(nu/2, 0.5/x)` with
`gammaUpperIncomplete(nu/2, 0.5/x)` directly. The complementary function
`gammaUpperIncomplete` was already exported from
`src/special/gamma-incomplete.js`, and already dispatches to the
continued-fraction `_gui` path (which computes `Q` natively) when
`x >= s+1` — the exact regime triggered by small InverseChi2 arguments.
This eliminates both subtraction-from-1 steps entirely for the
problematic regime.

For the upper tail (large `x`, where `0.5/x < s+1`), `gammaUpperIncomplete`
falls back to `1 - _gli(s, x)`. This is also a subtraction from 1, but only
when `_gli` is tiny — and the result itself is near 1 (correct for the
upper tail of InverseChi2), so it is normal rounding, not catastrophic
cancellation.

**2. Test framework fix** (`test/test-utils.js`):
Added a `refValTol(expected)` helper that returns the existing `PRECISION`
(1e-9 absolute) when `|expected| >= PRECISION`, or
`max(|expected| * 1e-10, Number.MIN_VALUE)` (relative) when below. This
ensures sub-precision refVals cannot pass vacuously. The 1e-10 relative
band leaves at least 3 orders of magnitude of headroom above typical
continued-fraction precision (~1e-13) so existing sub-precision refVals
do not break.

The framework fix was discovered during the TDD red phase: the
intentionally failing test did not fail under absolute tolerance,
exposing the gap before the production fix landed.

**3. Anchor refVal** (`test/dist-cases-continuous.js`):
Added `{ x: 0.01, pdf: 1.2054686549774487e-15, cdf: 2.509303552201057e-19 }`
to InverseChi2's refVals. The CDF value was derived in closed form via the
integer-shape identity
`Q(n, x) = e^{-x} · Σ_{k=0}^{n-1} x^k / k!`, specifically
`Q(3, 50) = e^{-50} · (1 + 50 + 1250)`. Both literals match Node's
IEEE 754 double-precision computation at exact bitwise equality.

## Prevention Strategy

**Three prevention layers.**

1. **Audit `1 - regularized_special_function(...)` patterns.** When a `_cdf`
   is expressed as `1 - F(g(x))` where `F` is incomplete gamma, incomplete
   beta, error function, or similar, check whether the library already
   exports the complementary form (`Q` instead of `P`, `erfc` instead of
   `erf`, `1 - I_x(a, b)` reformulated via `I_{1-x}(b, a)`, etc.) and use
   it directly. Never form `1 - regularized_special(...)` manually in `_cdf`
   without first verifying that the result of `regularized_special` is
   bounded away from 1 in the relevant regime.

2. **TDD red-phase verification.** After adding any refVal for a
   distribution's deep tail (CDF below `1e-9` or above `1 - 1e-9`), confirm
   the test actually fails under the broken implementation before declaring
   the RED phase complete. A test that passes when it should fail is worse
   than no test — it gives false confidence and locks in the bug.

3. **Boundary-region coverage on every distribution.** Add at least one
   refVal in each catastrophic-cancellation regime (lower tail, upper tail).
   The `refValTol` relative-fallback is now in place globally, but it only
   helps when a refVal in the regime exists. For distributions where
   `_cdf` calls a regularized special function with an argument that
   grows or shrinks with `x`, the lower/upper tail refVals should target
   the argument range where the inner function approaches 0 or 1.

## Related Solutions

- `solutions/correctness/2026-05-17-0847-validate-rejects-missing-params.md`
  — different problem (parameter validation), but shares the pattern of
  "framework-level fix discovered while implementing a feature".
- PR #240 (issue #214) fixed the same class of catastrophic cancellation in
  13 other distributions using `Math.expm1` / `Math.log1p` / `Math.tanh`
  builtins. This solution extends the pattern to incomplete-gamma-based
  CDFs. `InverseGamma._cdf` has the same bug structure and is being filed
  as a separate follow-up issue per the #243 scope.

## Key Insight

When `_cdf` is of the form `1 - gammaLowerIncomplete(a, g(x))` and `g(x)`
grows as `x` shrinks (as in all inverse distributions), switch to
`gammaUpperIncomplete(a, g(x))` directly — the library's
`gammaUpperIncomplete` already routes to the continued-fraction branch
that computes `Q` natively, eliminating the double subtraction-from-1
that makes the naive form return `0` instead of the correct
sub-`ulp(1)` value. The same insight applies to any
`1 - regularized_special_function` pattern: complementary functions exist
precisely because subtracting from 1 destroys information.
