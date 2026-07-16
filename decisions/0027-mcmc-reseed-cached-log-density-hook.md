# ADR-0027: Shared `_reseedCachedLogDensity` Protected Method for Metropolis-Family Samplers

**Date**: 2026-07-15
**Status**: Accepted

## Context

`RWM.seed()` (`src/mc/rwm.js`), `AdaptiveMetropolis.seed()` (`src/mc/adaptive-metropolis.js`), and `HMC.seed()` (`src/mc/hmc.js`) independently implement a byte-for-byte identical four-line override: call `super.seed(value)`, reseed their own `Normal(0, 1)` proposal/momentum generator (`this._q`), and recompute their cached log-density (`this.lastLnp = this.lnp(this.x)`) because `super.seed()` may have redrawn `this.x`. The inline comment explaining why the recompute is needed is copy-pasted identically in all three files.

ADR-0020 established `_iter`/`_adjust`/`_internal` as the only protected hooks in the `MCMC` subclass contract and noted that no fourth hook had been needed by any sampler family added so far. ADR-0022 stated that shared adaptation machinery should be extracted from `RWM`-family samplers "only when a second sampler family makes the common shape observable, not invented speculatively from a single subclass." That bar has since been cleared three times over: `RWM`, `AdaptiveMetropolis`, and `HMC` all independently arrived at the identical reseed-and-recompute logic. Issue #950 was filed specifically citing this precedent — extraction was deferred at #824 (HMC) review, but flagged once a second (now third) subclass exercised the identical pattern.

`Gibbs` and `SliceSampler`-related code have neither a subclass-owned PRNG component nor a cached log-density, so they are unaffected. `ARS` has its own `seed()` override that only reseeds the base `this.r` and does not share this pattern.

## Decision

Add a protected instance method `_reseedCachedLogDensity(value)` to `MCMC` (`src/mc/_mcmc.js`):

```js
_reseedCachedLogDensity (value) {
  this._q.seed(value)
  this.lastLnp = this.lnp(this.x)
}
```

Each of `RWM`, `AdaptiveMetropolis`, and `HMC` reduces its `seed()` override to:

```js
seed (value) {
  super.seed(value)
  this._reseedCachedLogDensity(value)
  return this
}
```

This is deliberately **not** a new entry in the `_iter`/`_adjust`/`_internal` contract from ADR-0020: it is not invoked automatically by any base-class control flow (unlike `_iter`, which `iterate()` calls, or `_adjust`, which `warmUp()` calls). It is a plain protected helper that a subclass's own `seed()` override calls explicitly, exactly as the issue's own suggested example (`_reseedCachedLogDensity`) named it. `MCMC.seed()` itself is unchanged. Subclasses without a `_q`/`lastLnp` pair (`Gibbs`, `SliceSampler`) simply never call it — there is no default no-op to maintain, and no behavior change for them.

This was chosen over two alternatives considered:
- **A standalone utility function** (e.g. `src/mc/_reseed-proposal.js` exporting `reseedProposal(sampler, value)`) — rejected because it introduces a duck-typing pattern (an external function reaching into `sampler._q`/`sampler.lastLnp`) with no precedent anywhere in `src/mc/` or `src/dist/`, where private helper files are self-contained algorithms or base classes, not object-mutating functions over parameters.
- **A new intermediate `MetropolisMCMC` abstract class** between `MCMC` and the three subclasses, owning `_q`/`lastLnp` construction and `seed()` entirely — rejected because it was not one of the two mechanisms the issue named, is disproportionate to a `trivial`/`low` issue (a hierarchy change across three call sites to deduplicate roughly eight lines), and is complicated by `HMC`'s constructor carrying an extra `gradLogDensity` argument that the other two subclasses don't have, which a fully shared constructor cannot cleanly absorb.

These three options were independently scored by a three-judge panel that split 1-1-1, each vote self-reporting "High confidence." See `solutions/tooling/2026-07-16-0624-design-panel-confidence-vs-verified-premises.md` for how the tie was broken (by re-verifying each vote's cited premise against the codebase rather than by vote count) and why trusting an issue's Scope section at face value would have missed `AdaptiveMetropolis` entirely.

## Consequences

**Easier:**
- The reseed-and-recompute logic and its rationale comment exist in exactly one place; a future Metropolis-family sampler that owns a `_q`/`lastLnp` pair can reuse `_reseedCachedLogDensity` from its own `seed()` override instead of copy-pasting a fourth time.
- No behavior change for any existing sampler; `test/mc.js`'s existing seed-reproducibility tests for `RWM`, `AdaptiveMetropolis`, and `HMC` continue to exercise the same effective logic unchanged.
- `Gibbs`, `SliceSampler`, and `ARS` are entirely unaffected — the new method is opt-in per subclass, not a base-class control-flow change.

**Harder:**
- `MCMC` now has one protected method beyond the `_iter`/`_adjust`/`_internal` contract that is not part of that contract's automatic invocation. Future readers of `_mcmc.js` must recognize `_reseedCachedLogDensity` as an explicitly-called helper, not a fourth override-me-or-else hook like the other three.
- If a future sampler owns a cached quantity that depends on `this.x` but is *not* named `lastLnp`, or a PRNG component not named `_q`, `_reseedCachedLogDensity` would need generalizing (e.g. parameterizing the field names) rather than being reused as-is.
