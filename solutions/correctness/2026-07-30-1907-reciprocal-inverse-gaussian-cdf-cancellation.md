---
date: 2026-07-30T19:07:57Z
category: "correctness"
problem: "ReciprocalInverseGaussian.cdf(x) returned garbage (quantized to multiples of 2^-53) for small x, discovered incidentally while validating an unrelated issue (#1194)"
status: complete
related_issue: "N/A (found during #1194's build session; fixed inline via bug-triage)"
related_plan: "N/A"
tags: [reciprocal-inverse-gaussian, inverse-gaussian, catastrophic-cancellation, survival-function, self-referential-test, boundary-guard]
---

# Solution: ReciprocalInverseGaussian.cdf() catastrophic cancellation for small x

**Date**: 2026-07-30T19:07:57Z
**Category**: correctness
**Related Issue**: N/A — found incidentally while validating #1194, fixed inline via this session's bug-triage stage

## Problem

`ReciprocalInverseGaussian.cdf(x)` returned a value quantized to multiples of `2^-53` — not
merely imprecise, effectively garbage — for small `x`. Concretely: `RIG(0.5, 4).cdf(0.2)`
returned exactly `1.1102230246251565e-16` (`= 2^-53`), when the true value is
`7.373070012124583e-17`, a ~34% relative error. Found by running the full bare
`python3 scripts/precision-refs-continuous.py` self-check (`self_check()`) as part of validating
an unrelated fix (#1194) — it was the single mismatch out of 3318 values checked.

## Root Cause

`ReciprocalInverseGaussian._cdf(x)` computed `1 - super._cdf(1 / x)`, i.e.
`1 - InverseGaussian.cdf(1/x)`. Since `X ~ RIG(mu, lambda)` iff `1/X ~ IG(mu, lambda)`, RIG's
small-`x` region maps to IG's large-argument region — exactly where `InverseGaussian.cdf(1/x)`
rounds to within 1 ULP of `1.0` in double precision. Subtracting a value that is `1.0` to machine
precision destroys essentially all significant bits of the result: a textbook catastrophic
cancellation, structurally identical to the `1+erf` cancellation `InverseGaussian._cdf` was
already hardened against
(`solutions/special-functions/2026-06-05-0000-inverse-gaussian-cdf-erfc-cancellation-cf-convergence.md`,
#690) — except that earlier fix only protected `InverseGaussian`'s own `_cdf`, not the
complementary "1 minus a near-1 CDF" pattern a *caller* could still trigger by composing it
naively. The stale test refVal at `test/dist-cases-continuous.js:5021` had frozen this exact
cancelled artifact as "truth" instead of catching it.

## Fix

Added a numerically-stable `InverseGaussian._survival(x)` (protected instance method,
`src/dist/inverse-gaussian.js`) computing `1 - CDF(x)` directly via the sign-flipped algebraic
complement of the existing `_cdf` formula:

```
_cdf:      0.5 * (erfc(-a) + erfcx(b) * exp(2λ/μ - b²))
_survival: 0.5 * (erfc(a)  - erfcx(b) * exp(2λ/μ - b²))
```

(derived from `erfc(-a) + erfc(a) = 2` applied to `_cdf`'s own formula, independently
re-verified: `cdf(x) + survival(x) == 1` to 50 mpmath digits at multiple parameter sets).
`ReciprocalInverseGaussian._cdf(x)` now calls `super._survival(1 / x)` instead of
`1 - super._cdf(1 / x)`.

Two further problems surfaced and were fixed during `/review`, each as instructive as the
primary fix:

1. **The public `survival()` method had the identical bug, unfixed.** The first pass only wired
   `_survival` into `ReciprocalInverseGaussian`'s internals — `InverseGaussian`'s own public
   `survival()` (inherited from the base `Distribution` class as `1 - this.cdf(x)`) still
   cancelled identically for large `x`. Fixed by adding an `InverseGaussian.survival(x)` override
   that delegates to `_survival`.
2. **That override introduced its own boundary bug.** `_survival`'s erfc/erfcx formula is only
   valid on the open support `(0, Infinity)` and, unlike the base class's `cdf(x)`, does not pass
   through `_belowSupport`/upper-bound guards before evaluating. The first draft of the override
   called `_survival` unconditionally, producing `NaN` for `x <= 0`. Caught during manual
   verification (`survival(-1)` → `NaN` instead of the correct `1`) and fixed with explicit
   boundary checks (`x <= 0 → 1`, `x === Infinity → 0`) matching `cdf()`'s own guard semantics.
   Adding the override also surfaced a coverage regression (99.96% functions, below the 100%
   threshold) from the new branches being untested — fixed by adding a dedicated
   `InverseGaussian.survival()` test (`test/dist-base-core.js`) covering the normal case and both
   boundaries.
3. **The corrected test refVal was initially self-referential.** The re-derived `cdf` value for
   the fixed test case was first sourced by describing the same erfc/erfcx `_survival` formula
   just added to production — directly violating CLAUDE.md's "never derive a reference value from
   the ranjs implementation itself" rule (a test that "passes even when the formula is wrong").
   Caught by `/review`'s tests reviewer. Fixed by re-deriving the value independently via the
   Python precision-refs script's separate, non-erfcx `ig_cdf` textbook formula
   (`Phi(a) + exp(2λ/μ)·Phi(-b)`, `scripts/precision-refs-continuous.py:471-479`) at `mp.dps=50`
   — confirmed digit-for-digit identical to the original (self-referentially-sourced) value, so
   only the comment's provenance claim was wrong, not the digits. A second refVal (`x=0.1`,
   deeper into the same cancellation regime) was added alongside it, since the original fix was
   only validated at the one magnitude that happened to trigger the report.

## Prevention Strategy

1. **A cancellation fix to one function does not protect every caller that independently
   composes `1 - <that function>(...)`.** When a distribution is implemented as a transform of
   another (`RIG(x) = 1/IG`), audit every place the *complement* of a near-boundary value is
   computed — not just the base function's own internals.
2. **Adding a numerically-stable internal variant of a public method (`_survival` beside `_cdf`)
   is two tasks, not one**: fixing the internal caller, and checking whether the base class's own
   public method (built from the naive `1 - cdf()` formula) needs the identical override. It is
   easy to do the first and silently skip the second.
3. **Any override that bypasses a base class's wrapper method must re-implement that wrapper's
   guards explicitly, and test them.** `_survival` bypassing `cdf()`'s `_belowSupport`/upper-bound
   checks is exactly the kind of gap a numerically-stable-tail formula is least likely to have
   been designed against — `x<=0`/`x===Infinity` are boundary inputs, not "normal" ones, and a
   formula derived for the tail case has no reason to handle them correctly by accident.
4. **Enforce "never derive a test reference from the implementation" literally, even during a
   fix's own follow-up correction to a refVal.** Re-deriving a value from "the formula we just
   wrote" feels like an obvious, safe correction in the moment; it is exactly the self-referential
   pattern the rule exists to catch. Use a genuinely independent reference path — here, a
   different formula already living in the Python precision-refs tooling — even when it's more
   work than reusing the formula already in hand.

## Related Solutions

- `solutions/special-functions/2026-06-05-0000-inverse-gaussian-cdf-erfc-cancellation-cf-convergence.md`
  (#690) — the original `InverseGaussian._cdf` erfc/erfcx cancellation fix this solution's
  `_survival` mirrors (sign-flipped) and extends to the complementary survival direction.
- `solutions/performance/2026-07-30-1747-dncbeta-self-check-incremental-ireg.md` (#1194) — the
  unrelated fix during whose validation this bug was incidentally discovered (running the full
  `self_check()` for the first time in a while, surfacing latent, unrelated mismatches — matching
  the same discovery pattern as #1193's stale-refVal find under #1110's restored self-check).

## Key Insight

A `1 - cdf(...)` (or any `1 - nearly_one_value`) composition silently produces garbage once the
subtracted value rounds to within 1 ULP of 1 — and this can hide inside a *caller* distribution's
transform (`ReciprocalInverseGaussian` reciprocating `InverseGaussian`) even after the callee's
own CDF has already been hardened against the identical cancellation pattern, so a numerical
stability fix must be audited for every consumer of the "near-1" value, not just the function
that first exhibited the symptom — and the same discipline (independent verification, explicit
boundary handling, non-self-referential references) that produced the fix must be reapplied to
every downstream artifact the fix touches, including its own test data.
