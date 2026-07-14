---
date: 2026-07-14T12:18:53Z
category: "testing"
problem: "runChains() had an unbounded chains multiplier and a silent seeds/chains mismatch; the red test for the missing bound became the runaway it was proving existed"
status: complete
related_issue: "#935"
related_plan: "thoughts/plans/2026-07-14-0534-runchains-multi-chain-helper.md"
tags: [mcmc, resource-exhaustion, bound-check, red-green-refactor, silent-truncation, testing-technique]
---

# Solution: runChains() unbounded chains multiplier + a red test that became the runaway it was testing for

**Date**: 2026-07-14T12:18:53Z
**Category**: testing
**Related Issue**: #935

## Problem

`ran.mc.runChains(logDensity, config, options)` (new in this session, `src/mc/run-chains.js`) validated `options.chains >= 2` but had **no upper bound**. It also accepted an optional `options.seeds` array without checking its length against `options.chains` — `runChains(f, {}, { chains: 5, seeds: [1, 2, 3] })` silently ran only 3 chains (`Array.prototype.map` over `seeds` simply ignored the requested `chains: 5`), returning an `rhat` diagnostic computed from fewer chains than the caller asked for, with no error and no warning.

While writing the red test to prove the missing upper bound — `runChains(f, { dim: 1 }, { chains: 10001 })`, using the function's own defaults (`warmUpBatches: 100`, `sampleSize: 1000`) to keep the test "realistic" — the test itself triggered the exact failure it was supposed to demonstrate the absence of a guard for: 10001 chains × (100 warm-up batches × 1e4 inner iterations + 1000 samples) ≈ **10 billion MCMC iterations**. The test hung and had to be killed via `TaskStop` mid-run.

## Root Cause

**The bound gap**: `runChains()` is a multiplier layered on top of an already-bounded primitive. `MCMC._validateCombinedFootprint(dim, maxLag)` (`src/mc/_mcmc.js`, backed by `_MAX_DIM`/`_MAX_LAG` = 10000 and `_MAX_ACCUMULATOR_BYTES` — see `solutions/correctness/2026-07-13-1624-mcmc-arwindow-sibling-bound-gap.md` for the prior audit that established these) bounds the memory footprint of *one* chain. `runChains()` constructs `chains` independent instances of that already-bounded footprint, but nothing re-examined whether the existing per-instance bound still held once a new axis (`chains`) multiplied it — a "run N of X" wrapper around an already-validated X creates a *new* unbounded axis even when X itself is safe in isolation. The bound on X does not compose into a bound on N×X automatically; it has to be added explicitly at the wrapper.

**The silent-truncation bug**: `chains` (a count) and `seeds` (a list whose `.length` implies a count) carry overlapping information, and only one of the two redundant sources of truth was validated. When two parameters can disagree, the code must pick an explicit policy — here, `.map` over `seeds` silently won by virtue of being the code path actually executed, discarding the caller's stated `chains` value without any signal.

**The test-authoring mistake**: a red test proving "large N is rejected" reused the function's expensive default parameters instead of driving every other cost-bearing knob to its cheapest legal value. Since the validation guard didn't exist yet (that's the point of a red test), the test had no fast-fail path and instead executed the full expensive computation the guard was meant to prevent.

## Fix

1. Added `if (seeds !== undefined && seeds.length !== chains) throw Error('runChains: seeds.length must equal chains')` — a mismatch now fails loudly instead of silently truncating the run.
2. Added `_MAX_CHAINS = 10000` (matching the existing `MCMC._MAX_DIM`/`_MAX_LAG` order of magnitude for consistency, not independently re-derived) and `if (chains > _MAX_CHAINS) throw Error(...)`, checked before any `RWM` instance is constructed.
3. Deliberately left `warmUpBatches`/`sampleSize` **unbounded** — they pass through unchanged to `warmUp()`/`sample()`, which are themselves unbounded by design elsewhere in the public API (an intentional caller-controlled compute-time tradeoff, not a memory-crash risk). Bounding them only inside `runChains()` would have been an arbitrary restriction inconsistent with calling `RWM` directly. Only `chains` — the new multiplier this function introduces — needed a new bound.
4. Rewrote the red test for `_MAX_CHAINS` to pass `warmUpBatches: 0, sampleSize: 0` alongside `chains: 10001`, so it exercises only the validation path (which throws before any chain is constructed). The test now completes in ~300ms instead of hanging, and would fail fast even in a hypothetical future regression where the bound check is accidentally removed.

## Prevention Strategy

- When wrapping an already-bounded primitive in a "run N of it" helper (fan-out, batch, multi-chain, multi-trial, ensemble, etc.), explicitly ask: *does this introduce a new unbounded multiplier axis, and does the wrapped primitive's existing bound already account for it?* It almost never does by default — validate the new axis independently rather than assuming the inner bound protects the outer loop. This generalizes the sibling-field-audit lesson from `solutions/correctness/2026-07-13-1624-mcmc-arwindow-sibling-bound-gap.md` (audit structurally parallel *fields*) to structurally parallel *layers* (audit structurally parallel *wrappers* around an already-bounded primitive).
- When two parameters carry redundant information (a count, and a list whose `.length` implies that count), validate their agreement explicitly. Silent truncation of a requested quantity is a correctness bug even though no exception was thrown and the output looked superficially plausible — it is the same class of failure the return-value conventions in `CLAUDE.md` require a `throw` for ("structurally impossible input"), just arrived at via two parameters disagreeing rather than one parameter being invalid in isolation.
- **Never write a red test for a resource-exhaustion/runaway-loop guard by relying on the function's own expensive default parameters to make the test "realistic."** Drive every *other* cost-bearing parameter to its cheapest legal value so the only thing under test is the validation/bound-check path itself. A correctly-placed bound check runs before any expensive work, so a well-constructed test proving the check exists should complete in milliseconds regardless of what value it's proving gets rejected. If a red test for "this should be rejected" takes more than an instant to fail, that itself is a signal the test is accidentally exercising the guarded behavior instead of the guard — treat a slow-to-fail rejection test as a bug in the test, not a quirk to wait out.

## Related Solutions

- `solutions/correctness/2026-07-13-1624-mcmc-arwindow-sibling-bound-gap.md` — the prior MCMC bound-check gap (`arWindow` missing the same `_MAX_*` treatment already applied to `dim`/`maxLag`); establishes the `_MAX_*` constant pattern and the sibling-field-audit discipline this solution extends to sibling-*wrapper* audits.
- `solutions/correctness/2026-07-11-1230-mcmc-state-key-mismatch-silent-sigma-loss.md` — a different flavor of the same underlying lesson (two related pieces of state, `state()`'s written key and the constructor's read key, silently disagreeing with no error) — silent divergence between two things that should agree is a recurring failure shape in this module.

## Key Insight

A resource-exhaustion bound and the test that proves it exists must be independently cheap — zero out every other cost-bearing parameter in the test so the guard check is the *only* thing exercised, otherwise "testing that N is capped" can itself become the uncapped runaway you're trying to prevent.
