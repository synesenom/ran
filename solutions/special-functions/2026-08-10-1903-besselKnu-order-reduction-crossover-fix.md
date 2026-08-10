---
date: 2026-08-10T19:03:12Z
category: "special-functions"
problem: "besselKnu silently returned up to ~77% relative error for order comparable to x, past the x=6 series/asymptotic crossover"
status: complete
related_issue: "#1361"
related_plan: "thoughts/plans/2026-08-10-1817-besselKnu-asymptotic-crossover.md"
tags: [bessel, besselKnu, besselK, asymptotic-expansion, crossover-threshold, order-reduction, upward-recurrence, DLMF, unbounded-loop, DoS-guard, isFinite]
---

# Solution: besselKnu order-reduction fix for the asymptotic crossover blind spot

**Date**: 2026-08-10T19:03:12Z
**Category**: special-functions
**Related Issue**: #1361

## Problem

`ran.special.besselKnu(nu, x)` — the modified Bessel function of the second kind at real
(fractional) order — silently returned wrong values, up to ~77% relative error, for orders `nu`
whose magnitude is comparable to `x`, just past the existing `x=6` series/asymptotic crossover
(e.g. `nu=4.82, x=7.18` returned `≈0.000358` vs. the correct `≈0.00154`). No error, warning, or
`NaN` signaled the defect — the function returned a plausible-looking finite double. The gap had
already been visible (but unfixed) in a separate randomized differential-testing harness's own
accepted `ulp_ceiling` calibration for `besselKnu` before issue #1361 was filed to fix it.

## Root Cause

`besselKnu` dispatched unconditionally to `_KAsymptotic(nu, x)` (DLMF §10.40.2's large-`x`
expansion) whenever `x > _X_K_SERIES` (=6), a threshold originally derived only for the fixed
orders `nu=0,1` used by `_K0`/`_K1`. `_KAsymptotic`'s "optimal truncation" (stop once the next
term stops shrinking) only bounds error correctly when the first correction term
`(4ν²−1)/(8x)` is already small. For `nu` comparable to `x`, that ratio is large (e.g. ~1.6 at
`nu=4.82, x=7.18`), so truncation fires at the very first correction term (k=1) and the function
silently returns the bare leading term with no correction applied — a single-variable threshold
(`x` alone) was being used to gate an error bound that genuinely depends on two variables (`nu`
and `x` jointly).

## Fix

Rather than tuning the crossover threshold or writing a new special-function primitive (an
initially-scoped ~90-line Temme series was rejected as unnecessary during design review), the
order is reduced to `mu = |nu| − round(|nu|) ∈ [−0.5, 0.5]`, a range hand-verified to keep both
the *existing* connection formula and the *existing* `_KAsymptotic` accurate at any `x`
(worst-case first-correction ratio ≈0.167 at `mu=1.5, x=_X_K_SERIES`, terminating exactly at
`mu=0.5`). A new `_besselKnuBase(mu, x)` helper reuses the same two-branch split `besselKnu`
already had, just applied at the reduced order. The base pair `K_mu, K_{mu+1}` is then carried
up to `K_{|nu|}` via the same upward recurrence (DLMF §10.29.1) `besselK` already uses for
integer order — valid because K is the minimal/recessive solution as order grows, so upward
recurrence is unconditionally stable (the mirror-image reason `I_nu` instead needs Miller's
*backward* recurrence). This mirrors the standard technique in GSL, Boost.Math, and Amos's
Algorithm 644 (order-reduce to a small base case, recur upward), cutting the fix to ~30
production lines with no new algorithm. Net diff: 57 insertions / 9 deletions after a `/review`
security-agent finding added a guard (see below).

A second, independent bug was caught during `/review`: the new loop
`for (let i = 1; i < n; i++)` with `n = Math.round(Math.abs(nu))` hangs forever if `nu` is
non-finite (`Math.round(Infinity) === Infinity` in JS, so `i < n` never becomes false) — a
regression versus the old code, whose bound (`_KAsymptotic`'s `MAX_ITER=100`) was independent of
`nu`. Fixed with `if (!isFinite(nu)) throw Error(...)` at `besselKnu`'s entry, before any
dispatch, per ADR-0015's "caller/programming error → throw" convention; `NaN` now throws too
(previously it silently short-circuited via `i < NaN` always being false, returning a
wrong-but-finite value instead of the mathematically correct `NaN`).

Verified against mpmath (`mp.dps=50`) across `nu ∈ [3,10], x ∈ [6,15]` (`scripts/precision-refs-special.py`,
`test/precision-special.js`), with zero regressions to pre-existing `besselK`/`besselKnu`
reference values (verified via a semantic key-by-key diff, not a line diff, since the entire
generated array shifts on any insertion).

## Prevention Strategy

When a special function switches between a series/expansion and an asymptotic form based on a
crossover threshold, check whether the asymptotic's truncation-error bound genuinely depends on
only the variable the threshold is keyed on. If the function has a second parameter (here, order
`nu`) that also appears in the truncation ratio, a single-variable threshold derived for one
fixed value of that second parameter (here, `nu=0,1` for `_K0`/`_K1`) silently stops being valid
once a caller exercises the function at a different value of that parameter — reading a
threshold's own derivation comment to check *which* inputs it was actually derived for is cheap
and would have caught this before the differential-testing harness did.

When a threshold-tuning fix hits this two-variable wall, look first for an
order-reduction-plus-directionally-stable-recurrence pattern already established elsewhere in
the same file (`besselK`'s integer-order recurrence was the template here) before reaching for a
new numerical primitive — reusing the existing accurate-at-reduced-order formulas is often
sufficient and avoids the convergence-guard obligations (ADR-0049) a brand-new iterative method
would need.

Separately, any loop bound derived by rounding a caller-supplied numeric parameter
(`Math.round(Math.abs(nu))`) must be validated as finite before the loop is entered —
`Math.round(Infinity)` stays `Infinity` in JS and silently turns a bounded-by-construction loop
into an unbounded one. This is easy to miss in review because the old code's bound came from an
unrelated constant (`MAX_ITER`) rather than the parameter itself, so the change from
"always bounded" to "bounded only for finite input" is not visible from the diff's shape alone —
it has to be reasoned about explicitly whenever a loop bound changes from a fixed constant to a
caller-derived value.

## Related Solutions

- `solutions/special-functions/2026-07-05-1530-bessel-k-second-kind-cancellation-strategy.md` —
  established the `_X_K_SERIES=6` threshold and combined-series/asymptotic split this fix
  builds on top of (reused unchanged at the reduced order).
- `solutions/special-functions/2026-06-14-1240-e1-asymptotic-vs-continued-fraction-crossover.md` —
  same general pattern: an asymptotic series used past its valid regime silently produces a
  plausible-looking wrong value with no error signal.
- `solutions/testing/2026-07-14-1218-runchains-unbounded-chains-runaway-redtest.md` — same
  general pattern: an unbounded loop reachable via an unvalidated numeric input is a DoS risk;
  guard before the expensive work, not inside it.

## Key Insight

A series/asymptotic crossover threshold keyed on only one variable (`x`) silently stops bounding
error once a second variable the truncation ratio actually depends on (`nu`) grows — the general
fix is not a better threshold but reducing the dependent variable to a small fixed range where
the existing formulas are provably accurate everywhere, then reaching the real value via the
same directionally-stable recurrence already used elsewhere in the family (upward for the
recessive solution K, backward/Miller for the dominant solution I).
