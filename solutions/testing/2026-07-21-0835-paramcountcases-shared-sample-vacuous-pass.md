---
date: 2026-07-21T08:35:50Z
category: "testing"
problem: "Shared hardcoded sample array in a table-driven aic()/bic() test can make wrong-k assertions pass vacuously"
status: complete
related_issue: "#1049"
related_plan: "thoughts/plans/2026-07-21-0743-this-k-mismatch-audit.md"
tags: [this.k, aic, bic, lnL, -Infinity, table-driven-test, vacuous-pass, paramCountCases, support-mismatch]
---

# Solution: paramCountCases shared-sample vacuous pass

**Date**: 2026-07-21T08:35:50Z
**Category**: testing
**Related Issue**: #1049

## Problem

While adding 11 new entries to `test/dist-base.js`'s table-driven `paramCountCases` regression suite (each entry asserts `.k`, `.aic()`, and `.bic()` for a distribution with a corrected free-parameter count), 6 of the 11 new cases initially passed their `aic()`/`bic()` sub-assertions even before the corresponding production fix (`this.k = N`) was applied. Only the separate `.k` assertion correctly failed. This meant 2 of 3 assertions per case were not actually testing anything — a defect that would otherwise have shipped silently, since `npm test` reported green.

## Root Cause

The loop's `sample` is one shared, hardcoded array (`[0.1, 0.5, 1.0, 1.5, 2.0, 0.3, 0.8, 1.2, 2.5, 0.6]`) reused across every case unless a case supplies its own override. Several of the newly-added distributions have a support that doesn't cover this range for the constructor parameters originally chosen (e.g. `PERT(0,1,2)`'s support is `[0,2]`, excluding the array's `2.5`; `PowerLaw`'s support is permanently fixed to `(0,1)` regardless of its parameter, excluding every value `> 1`). When `x` falls outside a distribution's support, `pdf(x)`/`pmf(x)` is `0`, so `lnL(sample)` evaluates to `-Infinity`. `aic()` (`2*(k - lnL)`) and `bic()` (`k*ln(n) - 2*lnL`) then both evaluate to `Infinity` — **regardless of what `k` actually is**. The assertion `assert.strictEqual(d.aic(sample), 2*(k - d.lnL(sample)))` compares `Infinity === Infinity` and passes by numeric coincidence, silently defeating the very check it exists to perform. This is not specific to `this.k` bugs — any table-driven test that computes an `lnL`-based metric from a shared sample array across heterogeneous distributions is vulnerable the moment a new case has a support the array doesn't cover.

## Fix

Two complementary fixes, chosen per case:
1. **Widen constructor parameters** so the shared default sample stays inside support, when the distribution's support genuinely depends on its parameters (e.g. `PERT(0,1,3)` instead of `PERT(0,1,2)`, `JohnsonSB(0,1,3,0)` instead of `(0,1,1,0)`, `QExponential(1.5,1)` instead of `(0.5,1)` to get unbounded support).
2. **Add a per-case `sample` override**, for distributions whose support is *structurally* fixed regardless of the constructor parameter (`PowerLaw`'s support is always `(0,1)`; `R`'s is always `[-1,1]`) — no choice of parameters can make the shared array fit. The loop was extended to accept an optional `sample` field per case, falling back to the shared default when absent:
   ```js
   paramCountCases.forEach(({ name, ctor, k, inherited, sample: customSample }) => {
     describe(`${name} parameter count`, () => {
       const sample = customSample || [0.1, 0.5, 1.0, 1.5, 2.0, 0.3, 0.8, 1.2, 2.5, 0.6]
       ...
   ```
The defect was caught by manually running the full suite before the production fix and checking that all 33 new assertions (not just the 11 `.k` ones) genuinely failed — i.e. verifying true RED before writing GREEN, per the project's TDD discipline. A quick failure count (`21 failing` instead of the expected `33`) was the tell that something was off.

## Prevention Strategy

Before trusting a new entry in any `lnL`-derived table-driven test (`aic()`, `bic()`, `likelihood()`, or similar), verify `d.lnL(sample)` is finite for that entry's constructor arguments and sample — either by eyeballing the distribution's support against the sample range, or by adding an explicit `assert.isFinite(d.lnL(sample))` precondition in the loop body itself so a future out-of-support case fails loudly with a clear message instead of passing by `Infinity === Infinity` coincidence. When adding a case whose test count doesn't match `<number of cases> × <assertions per case>` after a supposedly-red run, don't assume the discrepancy is fine — it usually means some assertions are vacuous, not that the implementation is partially correct. This exact hardening (an explicit finite-`lnL` guard in the `paramCountCases` loop) was filed as a follow-up: see issue #1056.

## Related Solutions

- `solutions/correctness/2026-07-20-2359-beta-rectangular-inherited-k-bic-bias.md` — the `this.k` under/over-counting defect this test suite was written to catch; documents the production-code root cause and fix pattern, complementary to this doc's test-infrastructure focus.
- `solutions/testing/2026-07-18-0752-constructor-parity-test-default-value-tautology.md` — a different flavor of the same family (a test that passes vacuously due to a coincidental default value), worth cross-referencing when auditing table-driven tests for silent tautologies.

## Key Insight

A table-driven test that feeds one shared hardcoded sample into an `lnL`-based metric (`aic()`, `bic()`, likelihood) across many distributions can silently defeat its own assertions via `-Infinity === -Infinity` (surfacing as `Infinity === Infinity` after the metric's arithmetic) for any case whose support doesn't cover that sample's range — always verify or override the sample per case, and treat a lower-than-expected failure count during the RED phase as a signal to investigate, not a shortcut to GREEN.
