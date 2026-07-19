# ADR-0035: NUTS Sampler-Health Diagnostics — `_iter` Fields and NUTS-Local Accumulators

**Date**: 2026-07-19
**Status**: Accepted

## Context

`ran.mc.NUTS` mechanically handles two pathological conditions but surfaces neither to
the caller:

- **Divergent transitions** — a leapfrog leaf whose Hamiltonian drifts more than
  `DELTA_MAX = 1000` nats from the trajectory start (`src/mc/nuts.js`, `_buildTreeLeaf`,
  the `ctx.logU < DELTA_MAX + h ? 1 : 0` guard). The point is dropped from the slice and
  that branch stops.
- **Maximum tree-depth saturation** — the doubling loop in `_growTree` reaching
  `MAX_TREE_DEPTH = 10` (up to `2^10 = 1024` leapfrog steps) without a U-turn.

These are the primary signals that a NUTS run is untrustworthy: divergences indicate the
step size is too large or the target geometry is too extreme (biased exploration);
tree-depth saturation indicates the step size is too small (inefficient sampling).
Stan (`divergent__`, `treedepth__ == max_treedepth`), PyMC, and NumPyro all expose these
per-iteration. ranjs did not. The math is already correct — this is purely a visibility
and user-facing API gap (issue #1037).

Two design questions had to be settled, both governed by existing ADRs:

1. **How to carry the per-transition signals out of `_iter`.** ADR-0025 already extended
   `_iter`'s return shape from `{x, accepted}` to `{x, accepted, alpha}` for
   dual-averaging, and its "Harder" section explicitly anticipated *"a future subclass
   with its own continuous per-iteration diagnostic beyond `alpha`"* facing the same
   choice. This issue is that case.

2. **How to accumulate per-phase counts.** ADR-0023 makes the three base-class
   accumulator families (`_welford`, autocorrelation ring buffers, acceptance ring
   buffer) **contractual**: their divisors, reset cadence, and ring bounds cannot change
   without a superseding ADR. The new NUTS-local counts must ride that lifecycle (reset
   only at construction and `sample()` start, so a post-`sample()` read reflects the
   sampling phase) **without** altering any contractual family — exactly the relationship
   `ar()` has to acceptance.

A subtle correctness trap forced the field design: at a leaf, `sPrime === 0` means
*only* energy divergence, but after `_combineSubtrees` multiplies `sPrime` by the U-turn
indicator, `sPrime === 0` can mean *either* divergence *or* a U-turn. So divergence
cannot be inferred from `sPrime` at the tree level — a dedicated flag must originate at
the leaf and propagate up untouched by the U-turn check.

## Decision

**Per-transition fields.** `NUTS._iter` returns `{x, accepted, alpha, divergent,
maxDepthHit}`, extending the ADR-0025 shape additively. Both new fields are booleans:

- `divergent` — `true` iff any leaf in the tree diverged. It originates at the leaf as
  `divergent = (sPrime === 0)` (at depth 0 there is no U-turn check, so leaf `sPrime === 0`
  is exclusively the energy-divergence guard), and is OR-propagated up through
  `_buildTreeBranch`/`_combineSubtrees`/`_growTree`. The U-turn criterion touches only
  `sPrime`, never `divergent`, so U-turns are never miscounted as divergences.
- `maxDepthHit` — `true` iff `_growTree`'s loop exits with `j === MAX_TREE_DEPTH && s === 1`,
  i.e. it exhausted all `MAX_TREE_DEPTH` doublings without an early U-turn/divergence stop.
  The `s === 1` conjunct excludes the case where a U-turn stops the loop exactly at the
  last allowed doubling (the trajectory was satisfied, not artificially capped).

The integer trajectory depth (`treeDepth`) is deliberately **not** exposed — it has no
aggregate accessor or stated use case in the issue and would be scope creep; a follow-up
can add it if a depth histogram is ever wanted.

**Accumulators and accessors.** Two NUTS-local integer counters, `_divergenceCount` and
`_maxDepthCount`, are incremented inside `_iter` (which already has the `this.lastLnp`
side effect and runs exactly once per `iterate()` in both phases). They are reset by a
NUTS override of `_initAccumulators()` that calls `super._initAccumulators()` then zeroes
both — the first subclass to override that hook. This rides the ADR-0023 lifecycle
(reset at construction via virtual dispatch, and at `sample()` start) without changing
any contractual accumulator family; the override reads no NUTS-specific field, so it is
safe under the base constructor's virtual-dispatch call. Two public accessors,
`divergenceCount()` and `maxDepthCount()`, each return the corresponding integer,
mirroring the one-method-per-diagnostic style of `ar()`/`ac()`/`ess()`. Unlike `ar()`
(a rate) these return raw counts, as the issue specifies. The reads consume no
`this.r.next()`, so the `.seed()` bitwise-reproducibility tests are unaffected.

## Consequences

**Easier:**
- A caller can distinguish a healthy NUTS run from a pathological one, matching the
  diagnostics Stan/PyMC/NumPyro expose. `divergenceCount() === 0 && maxDepthCount() === 0`
  after `sample()` is the well-behaved signal.
- The counts ride the same phase lifecycle as `ar()` for free — no new reset plumbing,
  no change to the contractual accumulator mechanics.
- The `_initAccumulators()` override establishes a clean, ADR-0023-compatible extension
  point that any future sampler needing per-phase diagnostic counters can follow.

**Harder:**
- `_iter`'s return shape grows again (`{x, accepted, alpha, divergent, maxDepthHit}`).
  As ADR-0025 noted, this is not generalized into an open-ended bag; each field is added
  deliberately with its own rationale. A third diagnostic would face the choice anew.
- The divergence-vs-U-turn distinction is a load-bearing invariant that lives in the
  threading: `divergent` must originate only at the leaf's energy guard and never be
  touched by `_noUTurn`. A future refactor of the tree builder must preserve it, or
  U-turns will silently inflate the divergence count.

## Related

- [ADR-0025](0025-hmc-iter-alpha-field.md) — the `_iter` return-shape extension this ADR
  extends further; its "Harder" section anticipated this diagnostic.
- [ADR-0023](0023-mcmc-accumulator-mechanics.md) — the contractual accumulator lifecycle
  the new counters ride via the `_initAccumulators()` override.
- [ADR-0020](0020-mcmc-design.md) — the `_iter`/`_adjust`/`_internal` subclass contract.
- [ADR-0034](0034-nuts-euclidean-metric-adaptation.md) — the current NUTS implementation
  whose `_growTree`/`_buildTree` this change threads flags through.
