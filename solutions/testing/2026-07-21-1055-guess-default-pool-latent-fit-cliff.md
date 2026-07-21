---
date: 2026-07-21T10:55:04Z
category: "testing"
problem: "A default-pool inclusion test for ran.dist.guess() hung 78+ minutes, exposing an unrelated distribution's latent fit() cost"
status: complete
related_issue: "#1051"
related_plan: "thoughts/plans/2026-07-21-0900-guess-bessel-exclusion-removal.md"
tags: [guess, fit, powell, mocha-timeout, synchronous-hang, doubly-noncentral-beta, test-design]
---

# Solution: default-pool `guess()` test discovers a latent, unrelated `fit()` performance cliff

**Date**: 2026-07-21T10:55:04Z
**Category**: testing
**Related Issue**: #1051

## Problem

While closing a code-review coverage gap for issue #1051 (adding an "is this distribution reachable in `guess()`'s unfiltered default pool" test per formerly-excluded distribution), a test that called the real, unfiltered `guess(data)` — the actual ~144-distribution default pool, no `candidates` override — on data shaped like `Rice(5, 1)` and `NoncentralChi2(3, 10)` caused a full `npm test` run to hang for 78+ minutes at 100% CPU before being killed. `this.timeout(60000)` never fired.

## Root Cause

`DoublyNoncentralBeta._pdf` (`src/dist/doubly-noncentral-beta.js`), and by extension `DoublyNoncentralF` which delegates to it, evaluates a nested double-Poisson-mixing series — an outer `MAX_ITER=100` loop over an inner `recursiveSum` — whose cost balloons to 13–30+ seconds for a *single* `fit()` call on non-negative continuous data in this value range. Several other distributions (`DoublyNoncentralT`, `F`, `FisherZ`, `GeneralizedGamma`, `JohnsonSU`, `NoncentralT`, `QExponential`) share the same slow-candidate group for this data shape.

This cost is pre-existing and unrelated to #1051's actual change: `DoublyNoncentralF` was already unconditionally in `guess()`'s default pool before and after the `DEFAULT_EXCLUDED` removal. It had simply never been exercised — the only prior full-default-pool test used `Normal(5, 2)` data, whose occasional negative values hard-filter away every non-negative-support candidate (including `DoublyNoncentralF`) via `guess.js`'s support check, before `fit()` is ever reached. This test was the *first* to feed non-negative continuous data through the real unfiltered pool, and it landed squarely on the untested slow path.

Two compounding factors turned this into an indefinite hang instead of a clean, debuggable failure:

1. **Mocha's async timeout cannot preempt synchronous work.** `Distribution.fit()` runs Powell's optimizer as one long synchronous call. Node is single-threaded, so a timer-based test timeout literally cannot fire until that call returns control to the event loop — a slow candidate doesn't produce a clean timeout failure, it produces what looks like a hang.
2. **The cost is not reliably reproducible.** The same `NoncentralChi(3, 3)`-shaped seed measured 24.3s for the full pool in an isolated `node` process, then exceeded 60s inside the full mocha suite run for the identical seed/data — environment/scheduling-dependent, not a fixed constant. A one-off manual timing check is not enough to certify a test as safe.

## Fix

No production code was changed to fix the underlying `DoublyNoncentralBeta`/`DoublyNoncentralF` latency — that is an unrelated, pre-existing issue, filed separately as #1063, out of scope for #1051.

`test/guess.js`'s `FORMERLY_EXCLUDED` table gained an `unfilteredPool: boolean` flag. Only `VonMises` (whose `[-π, π]` support hard-filters away the entire non-negative candidate group, including the slow ones, before `fit()` is reached) and `Skellam` (discrete — a disjoint, much smaller/cheaper candidate set) assert against the real unfiltered `guess(data)` call. `Rice`, `NoncentralChi2`, and `NoncentralChi` — all non-negative continuous, all sharing candidate-pool membership with `DoublyNoncentralF` — are verified only through a fast, deterministic `candidates`-override fit-quality check (`guess(data, { candidates: [instance.constructor, alternative] })`). All five still get genuine "is this a good, reachable candidate" coverage; only the flaky, slow, unrelated-cliff-triggering assertion was avoided.

## Prevention Strategy

When a test is about to be the *first* to exercise a large, un-curated collection (here: `guess()`'s full default candidate pool) against a new data shape, treat that as a distinct risk category from ordinary assertion-writing:

- **Isolate before trusting an end-to-end assertion.** Loop over each candidate's `fit()` call individually (applying the harness's own hard filters) and time it, *before* writing a single assertion that exercises the whole collection through a mocha timeout. The timeout is not a safety net for synchronous work — see below.
- **A `this.timeout(N)` guard only bounds async test duration.** It cannot interrupt a runaway *synchronous* call. If the function under test is a synchronous, single-pass optimizer (Powell here) with no internal cost budget or early-abort hook, a slow input turns a would-be clean timeout failure into an indefinite process hang instead.
- **Don't fix an unrelated latent cliff inside the PR that exposed it.** If diagnosis shows the slow path belongs to code the current diff didn't touch and wouldn't exist without the current diff's testing choices (not its production change), file it as a separate issue and redesign the *test* to route around the known-slow path deterministically — narrow to a `candidates` override, or pick generating parameters whose hard filters structurally exclude the slow group — rather than leaving a flaky, multi-minute (or hanging) assertion in the suite.
- **Don't trust a single timing measurement as proof a test is safe.** Cost was observed to vary by more than 2x between an isolated run and the full suite for identical seeded data; re-run a newly-added slow-adjacent test at least twice before considering it stable.

## Related Solutions

- `solutions/testing/2026-07-14-1218-runchains-unbounded-chains-runaway-redtest.md` — the same category of mistake in a different subsystem: a red test for a resource-exhaustion guard relied on the function's own expensive default parameters instead of driving every other cost-bearing knob to its cheapest legal value, triggering a 10-billion-iteration runaway. Same lesson: a test exercising a large/expensive search space for the first time needs its own cost analysis, not an assumption that existing timeouts or guards will catch a runaway.

## Key Insight

A synchronous, single-threaded library call has no per-candidate cost budget, so being the first test to exercise a large default pool against a new data shape can silently trigger an unrelated distribution's latent performance cliff — and because a mocha timeout cannot preempt synchronous work, the failure mode is an indefinite hang, not a clean timeout, so isolate-and-diagnose (per-candidate timing) before trusting an end-to-end assertion against an uncurated pool.
