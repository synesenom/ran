---
date: 2026-07-11T12:30:00Z
category: "correctness"
problem: "MCMC.state() serialized internal state as 'internals' but constructor read 'internal', silently discarding all adapted proposal sigmas on resume"
status: complete
related_issue: "#616"
related_plan: "thoughts/plans/2026-07-11-1201-mc-tests.md"
tags: [mcmc, state-serialization, key-mismatch, round-trip, silent-data-loss, correctness, testing]
---

# Solution: MCMC State Key Mismatch — Silent Sigma Loss on Resume

**Date**: 2026-07-11T12:30:00Z
**Category**: correctness
**Related Issue**: #616

## Problem

`MCMC.state()` returned `{ x, samplingRate, internals: this._internal() }` but the constructor
read `initialState.internal` (singular). Every `state()` round-trip silently discarded all
subclass-specific adaptive state. For RWM, this meant all proposal widths (`_sigma` values)
tuned during `warmUp()` were reset to 1.0 on resume — the sampler restarted from the correct
position but with a cold, unadapted proposal. No error was thrown and no warning was emitted.

The primary visible fields (`x`, `samplingRate`) round-tripped correctly, so any test checking
only those two fields passed even though the entire adaptive state was silently dropped.

## Root Cause

A singular/plural typo between the writer (`state()` emitted `internals: ...`) and the reader
(constructor consumed `initialState.internal`) created a serialization contract mismatch.
Because `internal` has a fallback (`|| {}`), the constructor never saw a missing-key error —
it silently fell through to an empty object. The mismatch was invisible to tests that only
asserted position and sampling rate restoration.

## Fix

Changed `src/mc/_mcmc.js` line 46 from `internals: this._internal()` to
`internal: this._internal()`, aligning the serialized key with the constructor's reader.
Updated the `state()` JSDoc `@returns` to explicitly name all three properties: `x`,
`samplingRate`, and `internal`.

Tightened the state round-trip test to assert `rwm2.state().internal.proposal` deep-equals
`state.internal.proposal` — verifying that adapted proposal sigmas survive the round-trip, not
just position.

## Prevention Strategy

State round-trip tests must assert **every field that `state()` serializes**, including
subclass-specific fields such as adapted proposal widths — not just position and samplingRate.
A test that only checks `state.x` and `state.samplingRate` passes even when the entire adaptive
state is silently dropped.

Canonical round-trip test pattern:
1. Construct sampler, run `warmUp()` to drive adaptation
2. Call `state()` to snapshot
3. Construct a second sampler from that snapshot
4. Assert `newSampler.state()` deep-equals the original snapshot in full, including
   `internal.proposal`

Additionally: key names between `state()` and the constructor should match exactly — derive
both from a single named constant or write the round-trip test (TDD) before implementing
either side.

## Related Solutions

- [`solutions/correctness/2026-07-07-1500-path-prng-save-restore.md`](2026-07-07-1500-path-prng-save-restore.md) — Analogous pattern for Process: saving only mathematical state but not PRNG stream position breaks reproducibility invisibly; state round-trips must cover all stateful components.
- [`solutions/correctness/2026-07-07-1600-path-distinct-realizations-reset-not-path.md`](2026-07-07-1600-path-distinct-realizations-reset-not-path.md) — Round-trip restoration patterns for generating distinct realizations.

## Key Insight

When `state()` serializes internal state as `internals` but the constructor reads
`initialState.internal`, the round-trip silently drops all adapted parameters with no error —
only a test that explicitly checks the subclass-specific field (not just position) after a
full round-trip can detect this class of silent-data-loss bug.
