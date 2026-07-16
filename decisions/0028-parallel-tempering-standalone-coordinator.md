# ADR-0028: ParallelTempering as a Standalone Coordinator with Direct Replica-State Mutation

**Date**: 2026-07-16
**Status**: Accepted

## Context

Issue #830 asks for a Parallel Tempering (Replica Exchange MCMC, Geyer 1991) sampler: N replicas of a chain run at inverse temperatures β₁=1 > β₂ > … > βₙ, each targeting `βᵢ · log p(x)`. Periodically, adjacent replicas' current positions are proposed for a swap with acceptance probability `min(1, exp((βᵢ − βᵢ₊₁)(log p(xᵢ) − log p(xᵢ₊₁))))`, using the *unscaled* `log p`. The cold (β=1) replica's samples are the output.

Every existing sampler in `src/mc/` (`RWM`, `AdaptiveMetropolis`, `Gibbs`, `HMC`, `SliceSampler`) subclasses the abstract `MCMC` base class (`src/mc/_mcmc.js`) and implements its three-hook contract (`_iter`, `_adjust`, `_internal` — ADR-0020). That contract models exactly one Markov chain with one `x`, one `logDensity`, one set of accumulators. Parallel Tempering has no single `x` or `logDensity` at the coordinator level — it owns an *array* of independent chains and its defining behavior (swap proposals between two chains) is an interaction the single-chain contract has no hook for. `runChains` (`src/mc/run-chains.js`) is the closest existing precedent for a class owning an array of `MCMC` instances, but it runs each chain to completion independently and combines outputs only after both chains have finished (via `gelmanRubin`) — it never needs one chain to reach into another mid-run.

Two implementation questions followed directly from this:

1. **Should `ParallelTempering` subclass `MCMC`?** No single-chain state exists at the coordinator level, so the three-hook contract does not fit.
2. **When a swap between replica slots i/i+1 is accepted, what is exchanged?** A `design-propose`/`design-critique` review considered three options: (a) swap only `x` (and the replica's cached scaled log-density, `lastLnp`, where present) between fixed-temperature-indexed replica objects, leaving each replica's own adaptation state (proposal scale, covariance, step size) pinned to its temperature slot; (b) swap the entire replica object (adaptation state travels with the chain to a new temperature slot); (c) swap via a `state()`/constructor round-trip, reconstructing replica instances.

## Decision

**`ParallelTempering` is a standalone class, not an `MCMC` subclass.** It owns `this._replicas`, an array of full `MCMC` instances (one per temperature, built via the caller's `sampler` factory or the default `RWM`), and drives each one through its own public `iterate()` — not `sample()`, which resets accumulators, thins internally, and runs synchronously to completion, none of which fits a coordinator that must interleave single steps across replicas and propose swaps between them.

**Swap mechanics use option (a): swap positions only, via direct field mutation.** On an accepted swap, the coordinator exchanges `this.x` between the two replica objects, then — for any replica exposing a `lastLnp` field (`RWM`, `AdaptiveMetropolis`, `HMC`; checked via `'lastLnp' in replica`, false for `Gibbs`/`SliceSampler` which cache no such value) — recomputes `replica.lastLnp = replica.lnp(replica.x)`, since `replica.lnp` is each replica's own *scaled* target and the swapped-in position invalidates the previously cached value.

Option (a) is chosen over (b) and (c) because:

- **Adaptation state must stay pinned to its temperature slot, not travel with the chain.** RWM's per-component proposal scale (`_base`, learned from the running marginal std of the β-scaled target it warmed up against) and analogous state in `AdaptiveMetropolis`/`HMC` are only well-tuned for the density shape at *that* temperature. Option (b) would carry a hot-tuned proposal into the cold slot (or vice versa) on every swap, degrading mixing exactly where independent per-replica warm-up was supposed to prevent it.
- **Reconstructing instances (option c) is prohibitively expensive at Parallel Tempering's swap frequency** — potentially thousands of accepted swaps per `sample()` run, each requiring two full `MCMC` constructor calls (`_initAccumulators()` allocates typed arrays every time) — and it silently loses adaptation state that `_internal()` never serializes (e.g. RWM's Robbins-Monro batch counters `_pBatch`/`_pAccepted`/`_pN`). It would also require widening the issue-specified `sampler` factory signature `(scaledLogDensity, config) => MCMC` to accept `initialState`, a public API change beyond the issue's scope.
- **The `lastLnp` mutation is a deliberate, narrow layering violation, not a broad one.** No existing code reaches into an `MCMC` instance to mutate `this.x`/`this.lastLnp` from outside — the base class's own `_reseedCachedLogDensity` (ADR-0027) was extracted precisely to keep this kind of mutation inside the class hierarchy. `ParallelTempering` breaks that precedent because Parallel Tempering's core algorithm *is* an inter-chain state exchange with no single-chain analogue; every alternative considered either produces a wrong sampler (option b) or an impractically slow one (option c). The mutation is confined to two plain, already-public fields (`x`, `lastLnp`) that every affected sampler already exposes for its own `iterate()`/`seed()` machinery.

**Thinning cadence**: since replicas can learn different `samplingRate`s during independent warm-up, the coordinator advances every replica by `stride = Math.max(...replicas.map(r => r.samplingRate))` raw `iterate()` calls per round, then proposes one adjacent-pair swap (alternating even/odd parity each round). This over-thins replicas whose own learned rate is below the maximum, but does not affect correctness: the swap acceptance formula depends only on the replicas' current positions, not on how many raw iterations elapsed since the last swap.

## Consequences

**Easier:**
- Each replica keeps using its own independently-tuned proposal, exactly as if it were an ordinary standalone `MCMC` instance — no changes to `MCMC`, `RWM`, or any other sampler were needed.
- `warmUp()` requires no coordinator-specific logic beyond calling each replica's own `warmUp()` — no swaps happen during warm-up, matching the issue's scope.
- The `sampler` factory signature stays exactly as specified in the issue (`(scaledLogDensity, config) => MCMC`), with no widening for swap support.

**Harder:**
- `ParallelTempering` depends on two `MCMC`-subclass implementation details that are not part of the formal `_iter`/`_adjust`/`_internal` contract: the field name `x` (already effectively public/stable — read by `state()`, written by `iterate()`) and the convention that Metropolis-family samplers cache their scaled log-density as `this.lastLnp` (documented only informally, via ADR-0027 and the samplers' own source). A future sampler that caches its log-density under a different name would silently skip the `lastLnp` recomputation — safe (no crash, no corruption) but potentially under-informative if that sampler's `_iter()` assumed a stale cache. This is a known, accepted risk given the narrow set of samplers today (`Gibbs`/`SliceSampler` cache nothing and are unaffected by construction).
- `statistics()`/`ac()` computed directly on an individual replica mid-`ParallelTempering.sample()` run reflect a position sequence interrupted by swaps injected from outside that replica's own Markov chain — not a stationary single-chain trajectory in the sense `MCMC`'s own accumulator design (ADR-0020, ADR-0023) assumes. `ParallelTempering` does not expose or rely on per-replica `statistics()`/`ac()` itself; a caller who reaches into `this._replicas[i]` directly for diagnostics should be aware of this.
- Because `ParallelTempering` is not an `MCMC` subclass, it does not inherit `seed()`, `ar()`, `ac()`, or `state()` — it must implement its own `seed()` (propagating to its own swap-acceptance RNG and to each replica) and deliberately omits `state()`/resumability, per the issue's explicit out-of-scope note.

## Related

- [ADR-0020](0020-mcmc-design.md) — the `_iter`/`_adjust`/`_internal` subclass contract `ParallelTempering` does not use, and the reasoning (gradient-based samplers taking extra constructor args rather than widening `MCMC`) that this ADR's "don't force an ill-fitting abstraction" logic extends.
- [ADR-0027](0027-mcmc-reseed-cached-log-density-hook.md) — the existing convention that mutations of `lastLnp` happen only inside the class hierarchy (via `_reseedCachedLogDensity`), which this ADR's swap mechanics knowingly breaks in one narrow, justified place.
