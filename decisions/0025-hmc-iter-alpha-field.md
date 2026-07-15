# ADR-0025: `_iter()` Return Shape Extended with `alpha` for Dual-Averaging Adaptation

**Date**: 2026-07-15
**Status**: Accepted

## Context

ADR-0020 documents the `MCMC` subclass contract: `_iter(x, warmUp)` returns `{x, accepted}`, and `_adjust(i)` (called only from `warmUp()`, per `_mcmc.js:180`) receives exactly that object. `RWM._adjust` only needs the boolean `accepted` — its Robbins-Monro update nudges a log step-scale by a fixed `±delta` depending solely on whether a batch's acceptance rate is above or below target (`src/mc/rwm.js:103-114`).

`HMC` (issue #824) adapts its step size via Robbins-Monro **dual averaging** (Hoffman & Gelman 2014, §3.2), whose recurrence is `H_t = (1 − 1/(t+t₀))·H_{t−1} + (1/(t+t₀))·(δ − α_t)`, where `α_t` is the **continuous Metropolis acceptance probability** for iteration `t` (`min(1, exp(-H(θ*,r*) + H(θ,r)))`), not the boolean accept/reject outcome. `α_t` is a natural by-product of `_iter`'s own Hamiltonian computation (it is exactly the quantity compared against `this.r.next()` to decide `accepted`), but the current `{x, accepted}` contract has nowhere to carry it to `_adjust` without either a side-channel instance field (e.g. `this._lastAlpha`, set in `_iter`, read in `_adjust`) or extending the returned object.

A side-channel field would work but introduces implicit coupling between two methods that the existing contract deliberately keeps decoupled — `_adjust` currently derives everything it needs from the object `_iter` returns, not from ambient instance state `_iter` happens to have set. It also does not compose: NUTS (issue #825), explicitly scoped as HMC's direct successor and dependent on this same dual-averaging step-size adaptation, will need the identical `α_t` value from its own more complex trajectory-building `_iter`.

## Decision

`_iter(x, warmUp)`'s return shape is extended to optionally include `alpha`: `{x, accepted, alpha?}`. Subclasses that have no continuous acceptance probability to report (`RWM`, `Gibbs`) are unaffected — they continue returning `{x, accepted}`, and the base class's own consumer of `_iter`'s output, `_updateAccumulators(i.x, i.accepted)` (`_mcmc.js:158`), reads only `.x`/`.accepted` and ignores any extra key. This is a strictly additive change to the contract: no existing subclass, test, or base-class method is modified.

`HMC._iter` sets `alpha` to the Metropolis acceptance probability computed for that iteration's leapfrog trajectory (the same value compared against `this.r.next()` to decide `accepted`). `HMC._adjust(i)` reads `i.alpha` to drive the dual-averaging `H_t` update, instead of reading `i.accepted`.

## Consequences

**Easier:**
- `HMC._adjust` (and, later, `NUTS._adjust`) gets the exact quantity Hoffman-Gelman's dual-averaging recurrence requires, sourced from the same object the base class already threads from `_iter` to `_adjust` — no new instance field, no new base-class hook, no change to `_updateAccumulators` or any other base-class method.
- The contract stays self-documenting: reading `_adjust`'s parameter tells you everything it can depend on, without having to also check what side-channel fields the paired `_iter` might have set.

**Harder:**
- The `_iter` JSDoc/contract description in `_mcmc.js` and ADR-0020 must be read as "returns `{x, accepted}`, optionally `alpha`" rather than a closed two-key shape — a minor documentation precision cost, not a behavioral one.
- A future subclass with its own continuous per-iteration diagnostic beyond `alpha` would face the same choice again (extend the shape further vs. a side-channel field); this ADR does not generalize `_iter`'s return to an open-ended bag of subclass-defined fields, it only settles that `alpha` specifically is the right vocabulary for acceptance-probability-driven adaptation, reusable by any Metropolis-Hastings-family sampler (HMC, NUTS) that needs it.

## Related

- [ADR-0020](0020-mcmc-design.md) — the `_iter`/`_adjust`/`_internal` subclass contract this ADR extends.
- [ADR-0022](0022-rwm-joint-adaptive-metropolis.md) — RWM's Robbins-Monro adaptation, which needs only the boolean `accepted` and is unaffected by this change.
