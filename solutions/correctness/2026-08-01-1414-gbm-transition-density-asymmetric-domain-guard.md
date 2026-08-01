---
date: 2026-08-01T14:14:23Z
category: "correctness"
problem: "GeometricBrownianMotion's transition log-density guarded only the arrival state (xNext <= 0), not the departure state (xPrev <= 0), turning an impossible path's log-likelihood into NaN instead of -Infinity"
status: complete
related_issue: "#1153"
related_plan: "thoughts/plans/2026-08-01-1047-process-lnl-path.md"
tags: [process, geometric-brownian-motion, transition-density, domain-guard, asymmetric-argument, neumaier, lnL, clt-tolerance, test-discriminating-power]
---

# Solution: GBM transition-density asymmetric domain guard (xPrev vs xNext)

**Date**: 2026-08-01T14:14:23Z
**Category**: correctness
**Related Issue**: #1153

## Problem

Issue #1153 added `Process.lnL(path)` (transition log-likelihood of an observed path) plus a
protected `_transitionLnPdf(xPrev, xNext)` hook, implemented for `BrownianMotion`,
`OrnsteinUhlenbeck`, and `GeometricBrownianMotion`. `GeometricBrownianMotion`'s implementation
mirrors its existing `pdf(x, t)`'s `x <= 0 => 0` domain convention, but for a *transition* density
in log-space the correct impossible-state value is `-Infinity`, not `0`. The first version only
guarded the arrival state: `if (xNext <= 0) return -Infinity`.

Code review caught that a path visiting a non-positive state *before* its last element — e.g.
`gbm.lnL([1, -1, 2])` — computed the second transition as `Math.log(2 / -1) = Math.log(-2) = NaN`,
which is not caught by `neumaier()`'s existing `±Infinity`-propagation logic (it only special-cases
non-finite *sums*, not a `NaN` term arriving in the first place), so the whole path's log-likelihood
silently became `NaN` instead of the mathematically correct `-Infinity` (an impossible path has
zero probability, i.e. log-likelihood `-Infinity` — "no value at all" (`NaN`) is a different, wrong
answer per `decisions/0015-return-value-and-error-conventions.md`). The bug was invisible to the
original test suite because the only non-positive-state regression path was the 2-element
`[1, -1]`, where the offending state is the *last* one — the one place the pre-fix code already
handled correctly.

## Root Cause

A two-argument transition/conditional density function has two independent domain boundaries, one
per argument. It's natural to copy the single-argument `pdf(x, t)` convention (`x <= 0 => `
sentinel) onto the "output-shaped" argument (`xNext`, which plays the same role as `pdf`'s `x`) and
forget the "input-shaped" argument (`xPrev`) needs an identical guard — nothing about the
single-argument precedent signals that a second, symmetric check is required. The test gap
compounded this: a 2-element path can only ever expose a guard bug in the *final* state (there is
no interior state to violate), so an asymmetric guard is untestable at that fixture length no
matter how many 2-element cases are added.

This is the same shape of defect documented previously for other two-argument functions in this
codebase: `solutions/algorithm/2026-06-01-0210-chandrupatla-bracket-guard-and-brent-defects.md`
(a bracket guard checked only one relationship between two endpoints) and
`solutions/correctness/2026-07-31-1300-doubly-noncentral-t-pdf-cancellation-x-mu-negative.md` (a
two-argument `pdf(x, mu)` had an asymmetric numerical-stability blind spot when the two arguments
had opposite signs). Two-argument domain/stability issues in this codebase recur specifically
because it's easy to reason about one argument at a time and assume symmetry that isn't actually
implemented.

## Fix

Guard both endpoints in a single condition:
`if (xPrev <= 0 || xNext <= 0) return -Infinity` (`src/process/geometric-brownian-motion.js`).
Added a 3-element regression path `[1, -1, 2]` (non-positive state in the *middle*, not the last
position) asserting `gbm.lnL(...) === -Infinity`, specifically because a boundary-position-only
fixture cannot exercise the departure-state guard.

Separately (same session, different finding): the new `.lnL()` tests originally checked only
`Number.isFinite(...)` on a seeded `path()`-generated sample — a weak assertion that would pass
even with a wrong variance, dropped Jacobian term, or wrong `decay`/`noise` constant. Replacing it
with a CLT-tolerance assertion against the known per-step transition-density expectation
(`E[-0.5*z^2] = -0.5` exactly, since each residual `z` is exactly `N(0,1)` by construction) is the
right shape of test, but the *first* attempt used an 8-sigma tolerance at `n=50` steps that was
verified (by literally injecting a 1.5x noise-scale bug into `OrnsteinUhlenbeck` and running the
test) to NOT catch the injected error — the tolerance was mathematically valid but too loose to be
load-bearing at that sample size. Raising the path length to `n=2000` (tolerance shrinks as
`1/sqrt(n)` for the per-step mean) made the same injected bug fail the test, confirmed by
re-running the injection check before reverting it.

## Prevention Strategy

- **For any function accepting two related state/domain arguments** (transition densities,
  conditional densities, paired-endpoint checks): guard *both* arguments explicitly in the same
  statement, and add a test fixture where the domain violation occurs in a **non-terminal**
  position — not just at the sequence's start or end — to prove both guards are wired, not just
  one. When translating a `pdf(x)`-style single-argument convention into a two-argument transition
  function, treat the convention as needing duplication across both arguments, not a single
  copy-paste.
- **For any new CLT-tolerance statistical test**: don't trust the tolerance formula's derivation
  alone. Validate its actual discriminating power by deliberately injecting a plausible wrong-
  formula bug (wrong scale, dropped term, wrong sign) into the implementation, confirming the new
  test fails, then reverting the injected bug. A CLT tolerance that's mathematically correct can
  still be too loose in practice at a given sample size — this mirrors
  `solutions/testing/2026-07-28-1601-flat-tolerance-masks-estimator-bugs.md`'s broader point that
  tolerance choice is itself something to verify, not just derive.

## Related Solutions

- `solutions/algorithm/2026-06-01-0210-chandrupatla-bracket-guard-and-brent-defects.md` — two-argument bracket guard checking only one endpoint relationship
- `solutions/correctness/2026-07-31-1300-doubly-noncentral-t-pdf-cancellation-x-mu-negative.md` — two-argument `pdf(x, mu)` asymmetric numerical blind spot
- `solutions/testing/2026-07-28-1601-flat-tolerance-masks-estimator-bugs.md` — tolerance choice must be verified, not just derived, or it silently stops being load-bearing

## Key Insight

When a two-argument transition/conditional density is derived from a single-argument `pdf(x)`
convention, guard *both* arguments explicitly and test with a fixture where the domain violation
sits in an interior position — a boundary-position-only fixture can hide an asymmetric guard bug
that silently turns `-Infinity` into `NaN`; and any new CLT-tolerance test's discriminating power
must be confirmed by injecting a bug and watching the test fail, not assumed from the formula alone.
