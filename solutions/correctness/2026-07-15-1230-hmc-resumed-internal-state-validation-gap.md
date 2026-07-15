---
date: 2026-07-15T12:30:00Z
category: "correctness"
problem: "HMC validated config.stepSize/config.pathLength but not the equivalent values arriving via a resumed initialState.internal, letting a corrupted or adversarial internal.pathLength (e.g. Infinity) reach a loop bound and hang the process; stepSize validation also let Infinity through"
status: complete
related_issue: "#824"
related_plan: "thoughts/plans/2026-07-15-0955-hmc-sampler.md"
tags: [mcmc, hmc, state-validation, resumed-state, dos, hang, sibling-channel-audit, infinity]
---

# Solution: HMC's Resumed State Bypassed Validation, Enabling a Hang

**Date**: 2026-07-15T12:30:00Z
**Category**: correctness
**Related Issue**: #824

## Problem

While implementing `HMC` (a new `MCMC` subclass, issue #824), code review
found that the constructor validated `config.stepSize`/`config.pathLength` at
fresh construction, but read the equivalent values from a *resumed* state
(`this.internal.stepSize`/`this.internal.pathLength`, populated by the base
`MCMC` constructor from `initialState.internal` — the object `state()`
returns for round-tripping a sampler) without validating them at all:

```js
this._stepSize = this.internal.stepSize || config.stepSize || 0.1
this._pathLength = this.internal.pathLength || config.pathLength || 10
```

`new HMC(logDensity, gradLogDensity, {}, { internal: { pathLength: Infinity }
})` bypassed every check and hung the process inside `_leapfrog`'s
`for (let l = 0; l < this._pathLength; l++)` loop — a true infinite loop, not
a slow-but-bounded computation.

Separately, `_validateStepSize`'s original check, `!(stepSize > 0)`, let
`Infinity` through silently, since `Infinity > 0` evaluates to `true` in
JavaScript — a gap independent of which channel (`config` or `internal`) the
value arrived through.

## Root Cause

Every `MCMC` subclass constructor accepts the same logical value through two
channels: `config` (fresh construction) and `initialState.internal` (resume,
via `state()`'s round-trip). `HMC`'s constructor was written by mirroring the
validation pattern already used for `config.*` fields, but nothing in the
`MCMC` base contract, in ADR-0020, or in any prior review calls out "every
field with a config/internal dual-input must run the same validator against
both channels" as a rule — so the author (and the design-propose/design-
critique pass during planning) validated the channel that was top of mind
(`config`, the common case) and did not think to re-apply the identical check
to `internal` (the resume case).

`RWM` has the exact same structural gap: `this._base = (this.internal.proposal
|| new Array(this.dim).fill(1)).slice()` (`src/mc/rwm.js:39`) consumes
`internal.proposal` with zero validation. It has simply never manifested as a
bug because `_base`'s values feed a proposal *scale factor*, not a loop
bound — a corrupted `proposal: [Infinity]` produces a badly-scaled (or
NaN-producing) sampler, not a hang. The underlying gap (unvalidated resumed
state) is identical; only the consequence differs based on what the value is
used for downstream.

The `Infinity` validation gap is a second, narrower root cause: `stepSize > 0`
is a comparison that is vacuously true for `Infinity`, and nothing in the
check explicitly required finiteness. This is the same shape of trap `NaN`
comparisons also produce (any comparison with `NaN` is `false`), but for the
opposite direction — `Infinity` passes checks that read as "must be positive"
without an explicit finiteness requirement.

## Fix

1. Added `HMC._validateStepSize(this.internal.stepSize)` and
   `HMC._validatePathLength(this.internal.pathLength)` calls alongside the
   existing `config.*` validation calls, reusing the same validator
   functions against both channels.
2. Tightened `_validateStepSize` from `!(stepSize > 0)` to
   `!(Number.isFinite(stepSize) && stepSize > 0)`, explicitly rejecting
   `Infinity` (and `-Infinity`, `NaN`) regardless of which channel the value
   arrives through. `_validatePathLength` already used `Number.isInteger`,
   which correctly excludes `Infinity` without needing a separate finiteness
   check.
3. Added tests: `initialState.internal.stepSize`/`.pathLength` set to
   `Infinity` now throws the same error a bad `config` value would; a direct
   `stepSize: Infinity` test was added alongside the existing zero/negative
   cases.
4. Strengthened the existing state round-trip test, which had a false-
   negative failure mode: it never called `warmUp()`, so `_stepSize` never
   left its constructor default (`0.1`) before being round-tripped — meaning
   a broken read of `internal.stepSize` that silently fell back to the same
   default would have made the test pass anyway. This is the identical
   failure shape as
   `solutions/correctness/2026-07-11-1230-mcmc-state-key-mismatch-silent-sigma-loss.md`
   (a round-trip test that never drives the value away from its default
   cannot detect that the round-trip silently drops it). The test now runs
   `warmUp()` first and asserts the captured `stepSize` is not the default
   before checking the round-trip.

## Prevention Strategy

For any `MCMC` subclass field that can be supplied through both `config` (at
fresh construction) and `initialState.internal` (at resume): validate both
channels with the identical check, not just the one channel the author
happened to write first. This generalizes the sibling-field-audit principle
from `solutions/correctness/2026-07-13-1624-mcmc-arwindow-sibling-bound-gap.md`
(audit structurally identical *sibling fields* — `dim`/`maxLag`/`arWindow` —
for the same bound) to structurally identical *input channels* for the same
field. When adding or reviewing an adaptable-state field on any `MCMC`
subclass, explicitly ask: "if this value arrives via a resumed state object
instead of fresh config, does it hit the same validation?" `RWM`'s
`internal.proposal` has this same unvalidated-on-resume gap today — it simply
lacks a loop that turns a bad value into a hang rather than a bad number; it
is a legitimate, narrowly-scoped follow-up, not a "different case, no bug."

For numeric "must be positive" validators specifically: a bare `value > 0`
check is vacuously satisfied by `Infinity`. If the field feeds a loop bound,
an array size, or any other place where "very large" is as dangerous as
"invalid," pair the positivity check with `Number.isFinite(value)`
explicitly — don't rely on the comparison alone to reject unbounded values.

For round-trip tests of any adapted/adaptive state: always drive the sampler
(e.g. `warmUp()`) before snapshotting `state()`, so the captured value is
provably different from the constructor default. A round-trip test whose
captured value coincidentally equals the default cannot distinguish "the
round-trip worked" from "the round-trip silently returned the default" — see
`solutions/correctness/2026-07-11-1230-mcmc-state-key-mismatch-silent-sigma-loss.md`.

## Related Solutions

- [`solutions/correctness/2026-07-11-1230-mcmc-state-key-mismatch-silent-sigma-loss.md`](2026-07-11-1230-mcmc-state-key-mismatch-silent-sigma-loss.md) — the round-trip-test-with-a-value-stuck-at-default pattern this PR's own test initially fell into, and the precedent for tightening it.
- [`solutions/correctness/2026-07-13-1624-mcmc-arwindow-sibling-bound-gap.md`](2026-07-13-1624-mcmc-arwindow-sibling-bound-gap.md) — the sibling-field-audit principle this solution generalizes from "sibling fields" to "sibling input channels for the same field."
- [`solutions/tooling/2026-07-15-1230-jsdoclint-src-mc-coverage-gap.md`](../tooling/2026-07-15-1230-jsdoclint-src-mc-coverage-gap.md) — a second, mechanism-unrelated but same-shaped gap found in the same PR: a dormant hole in shared `src/mc` infrastructure that only became visible when a new addition (`HMC`) was the first to exercise the code path it covers.

## Key Insight

Every `MCMC` subclass field with a `config`/`initialState.internal` dual-input pattern needs the identical validator run against both channels — validating only the fresh-construction path and trusting the resume path leaves a hole that a corrupted or adversarial state object can walk straight through, with the actual consequence (bad output vs. an outright hang) depending entirely on what the unvalidated value is used for downstream.
