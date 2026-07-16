---
date: 2026-07-16T06:00:18Z
category: "correctness"
problem: "ran.mc.Gibbs's inherited seed() silently failed to make sampling reproducible because Gibbs._iter() never read the sampler's own PRNG"
status: complete
related_issue: "#938"
related_plan: "thoughts/plans/2026-07-15-2108-gibbs-seed-rng-threading.md"
tags: [mcmc, gibbs, seed, reproducibility, prng, distribution-constructor, subclass-contract, opt-in]
---

# Solution: Gibbs Conditionals Receive the Sampler's PRNG So seed() Actually Reproduces

**Date**: 2026-07-16T06:00:18Z
**Category**: correctness
**Related Issue**: #938

## Problem

`ran.mc.Gibbs` extends `MCMC` and inherits `seed(value)`, whose JSDoc promises "seed the PRNG for reproducible chains." In practice, `gibbs.seed(42).sample(null, N)` called twice produced different output each time — a silent violation of a documented public-API contract.

This was not a fresh discovery: the exact same root cause had already surfaced once as a CI flake in an unrelated PR and was patched at the test level only (`solutions/testing/2026-07-15-2015-gibbs-conditionals-fresh-normal-seed-noop.md`), with that solution's own "Prevention Strategy" section explicitly flagging that the underlying library-level gap still needed a real fix rather than another test-side workaround. Issue #938 is that follow-up.

## Root Cause

`Gibbs._iter()` (`src/mc/gibbs.js`) never read `this.r` (the sampler's own PRNG, inherited from `MCMC`). Every per-iteration draw came from calling `this._conditionals[d](x1)` — an opaque, caller-supplied closure. The natural, idiomatic way to write a Gibbs conditional (`x => new Normal(rho * x[1], sigma).sample()`) constructs its own `Distribution` instance, and `Distribution`'s constructor seeds itself from `Math.random()` unless explicitly told otherwise (`src/core/xoshiro.js`). So `MCMC.seed()` (inherited unmodified by `Gibbs`) reseeded `this.r`, but `this.r` was structurally unreachable from inside the conditional closures — the sampler's PRNG and the conditionals' actual source of randomness were two disconnected systems, and nothing in the base class could bridge them.

This is the same shape of bug as `RWM`'s pre-fix state (see ADR-0022 context): a subclass whose real randomness lives in an object the base class's `seed()` doesn't know about. `RWM` closed that gap by overriding `seed()` to explicitly reseed its internally-owned `this._q` proposal generator. `Gibbs` had no equivalent internal object — its randomness lived entirely inside caller-supplied, opaque closures — so the `RWM` pattern couldn't be applied directly without first giving conditionals a way to draw from a sampler-owned, reseedable source.

## Fix

`Gibbs._iter()` now calls `this._conditionals[d](x1, this.r)`, threading the sampler's own PRNG into each conditional call as an additive second argument. No `Gibbs.seed()` override was added — the inherited `MCMC.seed()` already reseeds `this.r`, and that's the same object now passed through, so seeding the sampler and seeding the conditionals' draws become the same operation for any conditional that opts in (e.g. via `rng.next()`).

Three alternatives were evaluated in ADR-0026 (`decisions/0026-gibbs-seed-rng-threading.md`):
1. **Thread `this.r` into conditionals** (chosen) — additive, no `seed()` override, follows the "randomness flows through `this.r`" pattern used elsewhere in `_iter()`-based samplers.
2. **Throw from `seed()`** — smallest diff, but doesn't solve the problem at all, and makes `Gibbs` the only `MCMC` subclass whose `seed()` doesn't work.
3. **Duck-typed `.seed()` protocol on conditional functions** — no precedent anywhere in the codebase for attaching methods to closures; rejected as unnatural and prone to partial-reproducibility footguns.

This is explicitly an **opt-in, not automatic** fix: conditionals written in the pre-existing single-argument style continue to work unchanged (JavaScript silently drops unused trailing arguments) and remain exactly as non-reproducible as before. This asymmetry is intentional and documented in both the class JSDoc and ADR-0026 — it is a real, acknowledged limitation (the base class cannot force an opaque closure to consume a particular randomness source), not an oversight.

Tests (`test/mc.js`, `describe('.seed()', ...)` under `mc.Gibbs`) verify the actual data path, not merely that `.seed()` was called: conditionals in the new test explicitly call `rng.next()`, and two identically-seeded `Gibbs` instances are asserted `deepEqual` on their full sample output across three seeds, with a divergence check across different seeds and a backward-compatibility check that old-style (rng-ignoring) conditionals still run without error.

## Prevention Strategy

When a base class (`MCMC`, `Distribution`, etc.) documents a `seed()`/reproducibility contract, check every subclass for hidden randomness sources that don't flow through the class's own PRNG field — particularly anywhere a subclass delegates sampling to a caller-supplied closure or constructs a nested `Distribution` instance internally. `RWM`, `AdaptiveMetropolis`, and `HMC` already follow the correct pattern (own an internal generator such as `this._q`, reseed it explicitly inside an overridden `seed()`); any new `MCMC` subclass should be checked against that pattern before merge. Any subclass whose randomness lives inside an opaque caller-supplied function needs an explicit design decision (thread the PRNG through, throw, or some other explicit contract) recorded in an ADR before shipping — not discovered later via a CI flake, as happened here.

More generally: **a "seeded, deterministic" claim on a test is only as strong as the actual data path it exercises** (echoing the prior solution's key insight). When writing a reproducibility test for any sampler, verify the conditional/closure under test actually consumes the seeded generator — a test that merely calls `.seed(...)` somewhere is not proof the seed reaches every source of randomness the assertions depend on.

## Related Solutions

- [`solutions/testing/2026-07-15-2015-gibbs-conditionals-fresh-normal-seed-noop.md`](../testing/2026-07-15-2015-gibbs-conditionals-fresh-normal-seed-noop.md) — the prior incident this issue follows up on: a test-level-only workaround for the identical root cause, which explicitly called for the library-level fix this solution documents.
- [`solutions/correctness/2026-07-11-1230-mcmc-state-key-mismatch-silent-sigma-loss.md`](2026-07-11-1230-mcmc-state-key-mismatch-silent-sigma-loss.md) — a different flavor of the same underlying lesson: a test that only checks the visible surface can pass while the guaranteed contract is silently broken underneath.

## Key Insight

A subclass's inherited `seed()` only reproduces randomness that actually flows through the class's own PRNG field — if a subclass delegates draws to caller-supplied closures or lets them construct their own `Distribution` instances, `seed()` silently does nothing for that randomness unless the PRNG is explicitly threaded through the delegation boundary, and even then only for closures that choose to consume it.
