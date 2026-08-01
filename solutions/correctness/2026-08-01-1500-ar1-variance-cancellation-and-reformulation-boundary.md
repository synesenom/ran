---
date: 2026-08-01T15:00:00Z
category: "correctness"
problem: "AR1.variance(t) lost all significance (returned exactly 0) for near-unit-root phi combined with small fractional t; the fix's own expm1 reformulation then introduced a new NaN regression at t=0"
status: complete
related_issue: "#1243"
related_plan: "thoughts/plans/2026-08-01-1430-ar1-variance-tolerance.md"
tags: [ar1, process, catastrophic-cancellation, expm1, log1p, math-pow-boundary, numerical-reformulation, tdd-blind-spot, review-catch]
---

# Solution: AR1.variance() cancellation fix, and the boundary bug the fix itself introduced

**Date**: 2026-08-01T15:00:00Z
**Category**: correctness
**Related Issue**: #1243

## Problem

`AR1.variance(t) = sigma² · (1 − phi²ᵗ) / (1 − phi²)` suffered catastrophic cancellation for a
narrow parameter regime: `phi²` just outside the existing `|phi² − 1| < 1e-14` unit-root special
case, combined with a small fractional `t` (`t < 0.1`). In that regime `Math.pow(phi2, t)` rounds
to *exactly* `1.0` in double precision, so `1 − Math.pow(phi2, t)` evaluates to exactly `0` — a
100% relative error (the true variance is small but strictly positive), not merely reduced
precision. This silently propagated a plausible-looking `0` into `pdf()`'s and `marginal()`'s
existing `variance(t) ≤ 0` guards, turning a precision bug into spurious `NaN`/`throw` results for
otherwise-valid parameterizations.

Notably, the issue's own hypothesized failure mode (`Math.pow(phi2, t)` rounding *up* to `≥ 1`
for *large* `t`, producing negative/NaN variance) was checked by a ~39,000-point numerical sweep
(`phi2` deltas `1e-14`–`1e-1`, `t` up to `1e300`) and found never to occur — worst-case relative
error was `~5e-9`, always positive/finite. The real bug was the opposite mechanism: rounding
*down* to exactly `1` for *small fractional* `t`, not up for large `t`.

## Root Cause

`1 − x^t` is the textbook catastrophic-cancellation shape whenever `x` is close to `1` and `t` is
small enough that `x^t` also rounds to `1` — `Math.pow` has no way to preserve the sub-ULP
information needed to recover the true small difference. The codebase already had an established
idiom for this exact shape (`-Math.expm1(t * Math.log(x))`, used in `src/dist/pareto.js`,
`src/dist/weibull.js`, etc.), but it had never been applied inside `src/process/`, so `ar1.js`
carried an unreformulated `1 − Math.pow(...)` expression that nothing had flagged.

A second, distinct root cause surfaced during the `/review` stage of this same PR: the
reformulation itself introduced a *new* edge case the original `Math.pow`-based formula never
had. `Math.pow(x, 0) === 1` for **any** `x` per the ECMAScript spec — including `x = 0` or
`x = Infinity` — so the old formula was accidentally well-defined at `t = 0` for every valid
`phi` (including `phi = 0`, ordinary unvalidated white noise: `AR1`'s constructor only requires
`sigma > 0` and warns-but-allows `|phi| >= 1`, never rejecting `phi = 0`). The `expm1`/`log`
rewrite replaces that spec-guaranteed identity with `t * Math.log(phi2)`, which becomes
`0 * -Infinity = NaN` at `t = 0, phi2 = 0` (and the symmetric case where `phi2` overflows to
`Infinity`). The reformulation traded one cancellation bug for one `0 * Infinity` bug, because the
two formulas are only *numerically* equivalent away from the domain boundaries, not identically
defined at them.

A third, process-level issue surfaced in the same review pass: the three new test cases'
"independent" reference values were originally computed with the *same* `expm1`/`log` formula
that was just added to production (run standalone in Node, not via `ar1.js`, but mathematically
and structurally identical) — a tautology that would pass even if the reformulation itself were
subtly wrong, violating the project's rule that reference values must come from an external tool
(mpmath/scipy/R) and never share a formula with the code under test.

## Fix

1. Replaced `1 - Math.pow(phi2, t)` with `-Math.expm1(t * Math.log(phi2))` in `AR1.variance()`'s
   general-case branch — verified bit-identical to the old formula everywhere the old formula was
   already accurate (e.g. the pre-existing `phi=1.5, t=3 → 8.3125` test), and correct for every
   swept failing case (e.g. `phi2 = 1-2e-14, t = 1e-6` now returns `≈1e-6` instead of exact `0`).
2. Added an explicit `if (t === 0) return 0` fast path *before* the phi2-dependent branches,
   restoring the `t = 0` correctness the old `Math.pow` identity provided implicitly — this is
   also mathematically unconditional (`X_0 = 0` deterministically for every `phi`/`sigma`), so it
   needs no special-case reasoning of its own.
3. Regenerated the three new test cases' reference values via mpmath at `mp.dps=50`, evaluating
   the *original, untransformed* formula `sigma²(1 − phi2^t)/(1 − phi2)` (immune to cancellation
   at 50-digit precision) against the actual double-precision `phi2` — a genuinely independent
   computation of the same quantity via a different tool and a different (non-reformulated)
   formula, not a re-run of the fix's own expression.

## Prevention Strategy

**Numerical-reformulation edge-case pattern**: any `1 − x^t → -expm1(t·log(x))` rewrite changes
domain-boundary behavior, not just numerical conditioning. `Math.pow(x, 0) === 1` is a spec
guarantee for every `x` (including `0` and `Infinity`), which silently hides `t = 0` (and similar
boundary) correctness that a `log`-based reformulation does not inherit for free. **Whenever
replacing a `Math.pow`-based formula with a `log`/`expm1` equivalent, explicitly enumerate the
boundary values of every input (`t = 0`, `x = 0`, `x = ∞`, `x = 1`) and check the new formula's
behavior at each** — "numerically equivalent for typical inputs" does not imply "identically
defined at every input the old formula tolerated." Treat this as a checklist item for any future
`expm1`/`log1p` cancellation fix, not just this one.

**Review-catches-what-TDD-missed pattern**: the red-green tests for this fix were written to
prove the *specific hypothesized* failure mode (near-unit-root, small fractional `t`) — they
never touched `t = 0` or `phi = 0`, because those weren't part of the failure window under
investigation. TDD driven by "make this specific known-bad case pass" is necessarily narrower
than the new formula's full edge-case surface: it proves the fix works for the reported symptom,
not that the fix is safe everywhere. This gap was only closed by a `/review` pass (specifically
the `review-impact` agent) reasoning about the *new* formula's algebraic edge cases, not by more
testing of the *old* failure mode. When a fix is a formula reformulation (not a new distribution
or feature), the red-green test set is a floor, not a ceiling — a review step that asks "what
does the new expression do at 0, ∞, and its own stated domain boundaries?" is a distinct
verification step that TDD-for-the-reported-symptom does not cover on its own.

**Test-reference independence is a third, separate lesson**: it is possible for a fix's own
formula to sneak into its "independent" test reference values even without directly copy-pasting
production code — running the identical mathematical expression in a standalone script is still
the same formula. This is caught structurally (not by numerical analysis) by the project's
existing rule to cite an external tool (mpmath/scipy/R) by name in every `closeTo` reference
comment; the `review-conventions` and `review-tests` agents both independently flagged the missing
citation, which is exactly what that rule exists to catch.

## Related Solutions

- `solutions/correctness/2026-07-30-1907-reciprocal-inverse-gaussian-cdf-cancellation.md` — a
  different instance of the same `1 - cdf(large-argument)` cancellation family, fixed via a
  dedicated stable `_survival()` rather than an `expm1` rewrite (the two techniques solve the same
  class of problem via different mechanisms depending on what special function is available).
- `solutions/correctness/2026-07-31-1300-doubly-noncentral-t-pdf-cancellation-x-mu-negative.md` —
  another cancellation fix in the same PR cycle, illustrating that series-acceleration techniques
  (`wynnEpsilon`) cannot recover precision already lost to cancellation between individual terms —
  the fix has to attack the cancellation at its source, not downstream of it, which is the same
  principle underlying this AR1 fix (rewriting `1 - x^t` itself, not post-processing its result).

## Key Insight

A cancellation-safe `expm1`/`log` reformulation of `1 − x^t` fixes the cancellation bug but is not
a drop-in replacement — it changes behavior at domain boundaries (`t = 0`, `x = 0`) that
`Math.pow`'s ECMAScript-spec identities had silently made safe, so every such reformulation needs
an explicit boundary-value check (ideally as its own red test) rather than relying solely on the
TDD tests written for the originally-reported failure mode.
