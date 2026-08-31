---
date: 2026-08-31T17:21:17Z
category: "correctness"
problem: "f11()'s pole guard for b<=0 integer wrongly asserted +Infinity for cases where a competing numerator zero-crossing made the true value finite"
status: complete
related_issue: "#1415 (guard fix), #1423 and #1424 (deeper defects filed separately, not fixed here)"
related_plan: "thoughts/plans/2026-08-31-1530-remainder-cluster-eval-bridge.md"
tags: [special-functions, hypergeometric, confluent-hypergeometric, pole-guard, domain-guard, pochhammer-symbol, differential-testing, mpmath-verification, review-process]
---

# Solution: f11's b<=0 pole guard needed a competing-zero-crossing exception, refined across three review rounds

**Date**: 2026-08-31
**Category**: correctness
**Related Issue**: #1415 (guard fix); #1423 and #1424 (deeper defects filed separately)

## Problem

`f11` (Kummer's confluent hypergeometric ₁F₁, `src/special/hypergeometric.js`) had no guard for
`b` being a non-positive integer — a genuine pole where `_f11TaylorSeries`'s `(b)_k` Pochhammer
denominator hits exactly zero mid-recurrence. Without a guard, this produced an unguarded
division by zero yielding an inconsistently-signed `Infinity`/`-Infinity` depending on `b`'s
parity, rather than a well-defined result. Discovered incidentally by a random differential-
testing sweep (`scripts/difftest-special.py`) while bridging `f11` into the #1415
precision-testing pipeline, not by a targeted test for this case.

Adding the guard turned out to be a three-round exercise: each version review caught as still
wrongly returning `Infinity` for a legitimate, mpmath-confirmed-finite input.

## Root Cause

The obvious guard condition ("`b` is a non-positive integer") is necessary but not sufficient,
because it describes only the denominator's Pochhammer symbol in isolation. The numerator
carries its own Pochhammer symbol `(a)_k`, and when `a` is *also* a non-positive integer, the two
symbols race toward zero at their own respective recurrence indices (`k = -a` and `k = -b`).
Whichever hits zero first determines the actual behavior:

- If `a > b`, the numerator's zero at `k = -a` truncates the series into a finite polynomial
  strictly before the recurrence ever reaches the denominator's pole at `k = -b`, so the "pole"
  never fires — asserting `Infinity` there is a false positive contradicted by mpmath
  (`f11(-1,-2,3) = 2.5`, not `Infinity`).
- `a === b` is not covered by either "it's a pole" or "the numerator wins first" — both
  Pochhammer symbols hit zero at the *same* index, a genuine `0/0` indeterminate form that the
  recurrence (`t.a *= (a + i) * z / ((b + i) * (i + 1))`) silently corrupts to `NaN`. mpmath
  confirms this is finite (`f11(-1,-1,5) = 6`) but critically **not** `e^z` — the naive "`a` and
  `b` cancel" identity only holds for generic (non-integer-coincidence) parameters, not this
  degenerate case (`e^5 ≈ 148.4 ≠ 6`). An automated reviewer's own first suggested fix
  ("special-case `a===b` to return `e^z`") was itself wrong and had to be independently verified
  against mpmath and rejected before implementing anything.

A boolean guard built from a single necessary condition, without checking which of two competing
zero-crossings happens first, silently overreaches into cases the underlying math treats
differently.

## Fix

Iteratively narrowed the guard's exception clause across three review rounds until it matched
all three regimes mpmath actually distinguishes:

```js
if (b <= 0 && Number.isInteger(b) && !(Number.isInteger(a) && a <= 0 && a >= b)) {
  return Infinity
}
```

- `a > b` (strict): excluded — series terminates as a finite polynomial before the pole.
- `a === b`: excluded — genuine `0/0`, falls through to the pre-existing (honest) `NaN` from the
  corrupted recurrence rather than asserting a false `Infinity`. Making `a===b` actually *compute*
  the correct finite value was deliberately not fixed inline — it needs real numerical analysis
  (a limiting/analytic-continuation procedure), not a guard tweak — and was filed as a separate
  follow-up (#1424), with a `WITHHELD` precision-gate entry and a pinned regression test
  documenting the current `NaN` behavior and pointing at the tracking issue.
- `a < b` (both non-positive integers): guard still fires — this is the one case that is a
  genuine, unresolvable pole, now with dedicated precision-gate coverage that didn't exist before
  the third review round caught the gap.

A related but distinct defect — `f11`'s asymptotic branch (`_f11AsymptoticSeries`) silently
dropping the sign of `Gamma(a)` for negative non-integer `a` at `|z| >= 50`, the identical
`exp(logGamma-sum)-can't-reproduce-a-negative-factor` mechanism `beta.js`'s own `_gammaSign` fix
(#1416) already solved for a sibling function — was found by the same sweep and filed separately
as #1423, left unfixed as genuinely out of scope for this PR.

## Prevention Strategy

- When writing a domain guard for a special-function pole/singularity, do not stop at "this
  parameter alone would cause a divide-by-zero." Check whether *another* input can cause an
  earlier, competing zero-crossing (numerator vs. denominator Pochhammer symbols, cancelling
  leading terms, etc.) that changes the outcome before the naive trigger condition is reached —
  the exception clause carved out of a guard is exactly as load-bearing as the guard's main
  condition and needs the same scrutiny.
- Never accept an automated reviewer's *proposed fix* at face value, even when its diagnosis of
  the bug is correct — verify every suggested formula independently against ground truth
  (mpmath) before applying it.
- When a differential-testing sweep surfaces a genuine numerical defect deeper than the guard
  being drafted can safely fix inline, resist the urge to patch it superficially (e.g., asserting
  a plausible-but-wrong `Infinity`); let the honest failure mode (`NaN`) surface instead, document
  it with a pinned regression test and a `WITHHELD` precision-gate entry naming the tracking
  issue, and file the real fix separately.
- After narrowing a guard's boundary condition, add explicit test/precision-gate coverage for the
  case that *should still* trigger the guard, not just the cases that were incorrectly triggering
  it — a regression here would otherwise go silently uncaught.
- Double-check issue-number references in comments/tests/precision-gate entries against the
  actual filed issue when a differential-testing sweep produces multiple distinct follow-up
  issues in the same session — it is easy to cite a sibling issue found by the same sweep instead
  of the one actually tracking the code path being annotated.

## Related Solutions

- `solutions/correctness/2026-08-01-2030-noncentral-t-fnm-snm-boundary-saturation.md` — a parallel
  precedent, not a duplicate: a different function's guard also needed multi-round refinement
  because its initial trigger condition used the wrong signal (boundary-proximity of the output
  rather than the parameter that actually determines precision loss). Confirms the broader pattern
  that guard conditions in numerical code are seductively easy to get subtly wrong and benefit
  from adversarial, ground-truth-verified review — here the specific mechanism (competing
  Pochhammer zero-crossings) is different, but the meta-lesson is the same.

## Key Insight

A pole guard built from "parameter X alone triggers a divide-by-zero" is incomplete whenever
another parameter can cause a competing, earlier zero-crossing (numerator vs. denominator) —
enumerate every possible tie-breaking regime against an external reference (mpmath) before
trusting the guard's boundary, and treat the exception clause as first-class logic requiring the
same verification as the guard itself.
