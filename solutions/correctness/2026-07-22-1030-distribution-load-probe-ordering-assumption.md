---
date: 2026-07-22T10:30:00Z
category: "correctness"
problem: "Distribution.load() silently produced NaN on malformed/version-skewed state; the first fix attempt's probe-based validation itself broke valid load() round-trips for ~14 distributions, hidden by a passing 7957-test suite"
status: complete
related_issue: "#1074"
related_plan: "thoughts/plans/2026-07-22-0940-distribution-load-state-validation.md"
tags: [distribution, load, save, state-validation, this-p-this-c, constructor-arity, positional-arguments, false-confidence, test-coverage-gap]
---

# Solution: Distribution.load() State Shape Validation — Probe-Ordering Assumption Broke Valid Round-Trips

**Date**: 2026-07-22T10:30:00Z
**Category**: correctness
**Related Issue**: #1074

## Problem

`Distribution.load(state)` (`src/dist/_distribution.js`) restored `this.p`/`this.c` directly from
a serialized snapshot with zero shape validation. A malformed or version-skewed snapshot — e.g.
one saved before a distribution's `this.p`/`this.c` split changed under ADR-0018 — silently
populated missing keys as `undefined`, which propagated to `NaN` through `_pdf`/`_cdf`/
`_generator`/moment methods instead of throwing, violating ADR-0015's "structurally invalid
input must throw" convention.

The first fix attempt introduced a second, more subtle problem: it constructed a throwaway probe
instance via `new this(...Object.values(state.params))` (padded to constructor arity) to
determine the current class's expected key shape. This broke `BaldingNichols.load()` and
`DoublyNoncentralChi2.load()` — and potentially others — on **perfectly valid, previously-working
states**, discovered only via a `/review` pass, not by the 7957-test full suite that had already
passed.

## Root Cause

The probe approach assumed `this.p`'s key insertion order always matches the constructor's
positional parameter order. That holds for the ADR-0018 "full replace" convention
(`this.p = { ownKeys }`) but not for ~14 reparametrizing subclasses that **merge** into `this.p`
via `Object.assign(this.p, { ownKeys })` after `super()` already populated it with the parent's
keys (`BaldingNichols`, `DoublyNoncentralChi2`, `NoncentralF`, `Bates`, `BetaRectangular`, `Chi`,
`DoublyNoncentralF`, `ExponentiatedWeibull`, `F`, `GeneralizedGamma`, `GeneralizedNormal`,
`LogGamma`, `Weibull`, and more). For these, `this.p` ends up with more keys than the
constructor's own declared arity, and the order in which values end up positioned is
inconsistent across classes: some subclasses cleanly append new keys after the parent's
(`BaldingNichols`: `{alpha, beta, F, p}`, arity 2 — feeding `Object.values` positionally passes
`alpha`'s value as `F` and `beta`'s value as `p`), while others (`NoncentralF`) have a child key
**overwrite** a parent key in place rather than appending, so no simple "first N" or "last N"
heuristic generalizes.

Empirically: `new BaldingNichols(0.1, 0.5)` produces `this.p = { alpha: 4.5, beta: 4.5, F: 0.1,
p: 0.5 }`. The probe called `new BaldingNichols(4.5, 4.5)`, which maps `F = 4.5` — failing the
constructor's own `F < 1` constraint — so a completely valid, round-trippable state made
`load()` throw. The existing `dist-cases-continuous.js` test parameters for the ~14 affected
distributions never happened to produce an out-of-range value in the misaligned slot, so the
full test suite passed despite the bug — "passing by coincidence," the same failure shape as
`solutions/testing/2026-07-21-0835-paramcountcases-shared-sample-vacuous-pass.md` and
`solutions/correctness/2026-07-20-2359-beta-rectangular-inherited-k-bic-bias.md`.

## Fix

Replaced the positional-value probe with a **validation-suppressed** probe: construct the
throwaway instance with `Distribution.validate()` (and `console.warn`, to also avoid re-triggering
`Hoyt`'s unconditional deprecation warning on every `load()`) temporarily monkey-patched to a
no-op for the duration of that single synchronous construction, restored via `try`/`finally`.
Every constructor in the codebase sets `this.p`/`this.c` keys unconditionally, independent of
whether the parameter *values* pass range validation — so the probe never needs positionally
correct values, only "defined and not NaN" ones, to expose the correct key shape. This removes
the entire class of positional-ordering bugs without requiring any per-distribution change or
attempting to reverse-engineer each subclass's `Object.assign` merge pattern.

Verified via a sweep across all 314 test cases (143 distribution/case combinations,
`test/dist-cases-continuous.js` + `test/dist-cases-discrete.js`): 0 failures after the fix,
versus 2 confirmed regressions (`BaldingNichols`, `DoublyNoncentralChi2`) before it.

A separate reviewer flagged `Object.values(state.params)` as a getter-triggering code-execution
risk and proposed replacing all real values with dummy zeros. That suggestion was verified
empirically to be wrong — `new QExponential(0, 0)` throws on `lambda > 0`, which would break
every legitimate round-trip for any distribution with a strictly-positive-parameter constraint —
and was rejected with documented rationale rather than applied reflexively.

## Prevention Strategy

**A full green test suite is not proof of correctness when a fix's soundness rests on an
unenforced structural invariant** ("this.p insertion order == constructor argument order") that
only a subset of subclasses' *specific test fixture values* happen to exercise. When a change
depends on a cross-cutting assumption about many files' internal structure:

1. Prefer designs that consult only what's **unconditionally guaranteed** (here: key presence)
   over designs that additionally assume **value correctness or ordering** — the latter has a
   much larger surface for silent, convention-not-enforced exceptions buried in obscure
   subclasses.
2. If value-dependent ordering can't be avoided, write a dedicated invariant test that
   mechanically checks the assumption against *every* subclass (e.g., diff
   `Object.keys(instance.p).length` against constructor arity for all ~87 distributions,
   as this session eventually did for the Categorical case — but should have done for the
   `Object.assign(this.p, ...)` merge pattern too, before treating the first fix as final).
3. Adversarial multi-agent review (`/review`'s `review-correctness` pass) caught this after
   TDD's fixed fixtures did not. For changes whose correctness depends on convention-not-enforced
   across many files, a review pass that specifically asks "does this hold for every subclass,"
   not just the ones in the test suite, is a necessary complement to example-based tests.
4. Verify flagged review findings against real behavior (empirically) before either applying or
   dismissing them — this session both fixed a correctly-identified regression and rejected an
   incorrectly-reasoned one from the same review pass, in each case only after reproducing the
   claim directly rather than trusting the finding's framing.

## Related Solutions

- [`solutions/testing/2026-07-21-0835-paramcountcases-shared-sample-vacuous-pass.md`](../testing/2026-07-21-0835-paramcountcases-shared-sample-vacuous-pass.md) — same "passes by coincidence" shape: a table-driven test's specific fixture values masked a real defect.
- [`solutions/correctness/2026-07-20-2359-beta-rectangular-inherited-k-bic-bias.md`](2026-07-20-2359-beta-rectangular-inherited-k-bic-bias.md) — another inherited-state defect (this.k) invisible to ordinary tests, only caught by auditing every reparametrizing subclass systematically.
- [`solutions/distribution/2026-07-21-1252-reparametrizing-subclass-this-p-merge-vs-replace.md`](../distribution/2026-07-21-1252-reparametrizing-subclass-this-p-merge-vs-replace.md) — the `Object.assign(this.p, ...)` vs. full-replace convention this bug's root cause traces back to.
- [`solutions/distribution/2026-06-07-2138-continuous-subclass-natural-params.md`](../distribution/2026-06-07-2138-continuous-subclass-natural-params.md) — origin of the ADR-0018 `this.p`/`this.c` split whose migration state this validation now checks.

## Key Insight

When a validation fix relies on an assumption about key/argument ordering that holds "by
convention" across dozens of subclasses rather than being mechanically enforced, a full green
test suite only proves the assumption survived the specific parameter values already in the
test fixtures — redesign the fix to avoid needing the assumption (validate key presence only,
not value-dependent ordering) rather than trying to guess or patch around it.
