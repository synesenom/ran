# ADR-0021: Windowed Acceptance Rate for MCMC.ar()

**Date**: 2026-07-12
**Status**: Accepted

## Context

`MCMC.ar()` (`src/mc/_mcmc.js`) reports `_accepted / _totalIter`, two plain counters reset only in the constructor and at the start of `sample()` (ADR-0020 §1). `warmUp()` never resets them: a default `warmUp()` call runs 101 batches of 1e4 iterations (~1,010,000 total) with the same pair of counters accumulating throughout. A caller reading `.ar()` during or immediately after `warmUp()` — the documented use case being "did RWM's step-size adaptation reach its 0.44 target?" — gets a rate contaminated by the earliest, untuned batches, permanently dragged down (or up) by behavior that no longer reflects the sampler's current state. ADR-0020 designed the reset-on-`sample()` semantics deliberately, but did not address this case: its "Harder" consequences section lists four known costs of the accumulator design and omits cumulative-during-warmup `ar()` entirely (issue #920).

`RWM` already solves a structurally identical problem for its own internal step-size tuning: `_pAccepted`/`_pN` (`src/mc/rwm.js:24-25,56-69`) reset to zero every 100 draws per dimension, feeding Robbins-Monro adaptation toward a 0.44 target. This windowed rate is private and per-dimension; `ar()` is public and pools all dimensions. The two are not interchangeable, but the pattern — reset a counter on a cadence so a ratio reflects recent, not all-time, behavior — is already established in this codebase for exactly this class of problem.

External precedent (research: `thoughts/research/2026-07-12-1350-mcmc-ar-windowing.md`) confirms windowed (not cumulative) acceptance reporting is standard wherever the rate drives or diagnoses live adaptation: PyMC's `Metropolis.astep()` uses the same non-overlapping-batch-reset pattern as RWM's own tuner; Stan's HMC/NUTS dual-averaging resets at adaptation-window boundaries. Cumulative reporting (emcee's `acceptance_fraction`) is only adequate when the diagnostic is read once, post-hoc — not ranjs's use case, where `ar()` is polled live during/after `warmUp()`.

Three windowing mechanisms were evaluated via a design-propose/design-critique pass:

1. **Non-overlapping batch-reset** (mirrors RWM's `_pAccepted`/`_pN`, promoted to the base class, pooled instead of per-dimension): O(1) memory, but produces a discontinuity at every window boundary — `ar()` reads pure noise (0/1 or 1/1) for the first few iterations of each new window, then converges over the next `W` iterations. This reproduces, on a smaller cadence, the same "misleading instantaneous reading" problem the issue is trying to eliminate.
2. **Exponentially-weighted moving average (EWMA)**: O(1) memory, no boundary discontinuity, but has a cold-start bias — for roughly the first `3W` iterations after any reset, the estimate is dragged toward its initial value and underestimates the true rate. This is a correctness risk for precisely the scenario the issue targets (checking early-to-mid warm-up tuning), and introduces a smoothing-parameter idiom with no precedent anywhere else in the codebase (every existing accumulator in `_mcmc.js` is a plain counter or an algebraic streaming accumulator, never an EWMA).
3. **Circular-buffer sliding window**: a fixed-size `Uint8Array(W)` ring buffer recording accept/reject per iteration plus a running count; `ar()` returns `runningCount / min(totalIter, W)`. O(W) memory (1 KB at the default `W = 1000`). No boundary discontinuity — the window advances one iteration at a time. During the partial-fill phase (fewer than `W` iterations since reset), the formula reduces exactly to today's cumulative ratio, so behavior is unchanged until the window fills. Structurally mirrors the existing `_acBuf`/`_acCross` ring buffer already used for autocorrelation in the same file (`_mcmc.js`), reset in `_initAccumulators()` and updated in `_updateAccumulators()` the same way.

Both the proposing and critiquing passes independently converged on option 3 with high confidence, for the same reasons: it is the only option with neither a boundary discontinuity nor a cold-start bias, and it reuses a pattern already proven in this file rather than introducing a new one.

## Decision

`ar()` will report the acceptance rate over a fixed-size sliding window of the most recent `W` iterations (default `W = 1000`, configurable via `config.arWindow` at construction — an additive, backward-compatible constructor option; `ar()`'s own signature stays a zero-argument method).

**Mechanism**: `_initAccumulators()` allocates `this._arBuf = new Uint8Array(this._arWindow)`, `this._arCount = 0` (running count of accepted iterations currently in the buffer), and reuses `_totalIter`-style indexing (a new `_arN` iteration counter local to the window, mirroring `_acN`'s role for `_acBuf`). `_updateAccumulators()` subtracts the value being evicted at the write cursor, writes the new accept/reject outcome, adds it to `_arCount`, and advances the cursor modulo `W` — the same update shape already used for `_acBuf`/`_acCross`. `ar()` returns `this._arN > 0 ? this._arCount / Math.min(this._arN, this._arWindow) : 0`, preserving today's `0` return when no iterations have occurred (`_mcmc.js:102`) and reducing to the exact cumulative ratio during the partial-fill phase.

**Scope of the reset**: The sliding-window buffer resets wherever `_initAccumulators()` already runs — construction and the start of `sample()` — with no new reset points. During `warmUp()`, the buffer fills once over the first `W` iterations and then continuously slides for the remainder of warm-up, so `ar()` reflects at most the last `W` iterations at any point after iteration `W` — directly fixing the issue's complaint. During `sample()`, the same mechanism means `ar()` after a long `sample()` run reflects the last `W` sampling draws rather than the entire sampling phase; for a stationary post-warmup chain the two should closely agree, and the change is a strict improvement in freshness with no observed downside for the RWM-only case this ADR was validated against.

**Cumulative counters retained**: `_accepted`/`_totalIter` are kept unchanged, as private internal state, alongside the new windowed buffer — they cost nothing extra to maintain and leave the door open for a future all-time diagnostic without another design pass.

**RWM's internal tracker stays separate**: `_pAccepted`/`_pN` (`rwm.js:24-25,56-69`) is not unified with the new windowed `ar()`. The two serve different purposes (a live tuning signal driving Robbins-Monro adaptation vs. a user-facing diagnostic), operate at different granularity (per-dimension vs. pooled across dimensions — `_iter` returns one pooled `accepted` boolean regardless of `dim`), and reasonably use different cadences (100 draws for tuning responsiveness vs. 1000 for diagnostic stability). Coupling them would mean a user widening the diagnostic window silently perturbs the sampler's own adaptation dynamics.

**No serialization**: The new ring buffer does not round-trip through `state()`/`_internal()`. It follows the same convention as every other accumulator in `_mcmc.js` (`_welford`, `_acBuf`, `_accepted`, `_totalIter`) — all are ephemeral, reset by `_initAccumulators()`, and never serialized. This avoids the class of bug documented in `solutions/correctness/2026-07-11-1230-mcmc-state-key-mismatch-silent-sigma-loss.md` (a state-key mismatch silently dropping adapted state) by not adding a new serialized field at all.

**Base class only**: With `RWM` as the only concrete `MCMC` subclass today (`SliceSampler` removed in PR #615, re-add tracked separately as #822), this ADR commits to a base-class-only implementation now — consistent with ADR-0020 §2's stated approach of not adding subclass-specific hooks until a second sampler family demonstrates the need. If a future family (Gibbs, HMC/NUTS — todo.md, issues #821/#824-826) needs different acceptance-reporting semantics (e.g., Stan's continuous `accept_stat__` rather than RWM's binary accept/reject), this decision should be revisited rather than forced into the same buffer.

This ADR extends, rather than supersedes, ADR-0020: the accumulator model, the `_iter`/`_adjust`/`_internal` subclass contract, and the reset-on-`sample()` rationale are unchanged. Only the semantics of `ar()`'s output change, from all-time-since-reset to a bounded recent window.

## Consequences

**Easier:**
- `ar()` gives a live, meaningful reading at any point during a long `warmUp()` run, fixing the issue's motivating scenario (checking whether RWM's step-size adaptation has converged toward 0.44 without waiting for `sample()`).
- The partial-fill formula (`min(_arN, W)` as denominator) means behavior is byte-for-byte identical to today for any run shorter than `W` iterations — no regression for existing short-run tests or usage.
- Implementation reuses an established pattern (`_acBuf`-style ring buffer + modulo cursor), keeping the change small, low-risk, and easy to review against precedent already in the same file.

**Harder:**
- `ar()` after a `sample()` run longer than `W` iterations no longer reflects the *entire* sampling phase, only its last `W` draws — a subtle semantic change from ADR-0020's original framing ("statistics() and ar() cleanly separate warm-up-phase adaptation from sampling-phase results"). Callers wanting an all-time sampling-phase rate would need a future explicit accessor (the retained `_accepted`/`_totalIter` make this cheap to add later, but it is not exposed by this ADR).
- Memory cost per `MCMC` instance grows by `W` bytes (1 KB at the default) — negligible next to the existing `dim × maxLag × 8`-byte autocorrelation buffers, but no longer O(1) as the plain-counter design was.
- `config.arWindow` is a new constructor option; subclass authors and callers configuring samplers programmatically need to know it exists if they want a window size other than the 1000-iteration default.
