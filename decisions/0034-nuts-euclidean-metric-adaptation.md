# ADR-0034: NUTS Euclidean Metric Adaptation — Inline Leapfrog, Duplicated Machinery

**Date**: 2026-07-19
**Status**: Accepted

## Context

`NUTS` (`src/mc/nuts.js`) uses a fixed identity mass matrix: momenta drawn from
`N(0, I)`, kinetic energy `½‖r‖²`, and the leapfrog position update `x ← x + ε·r`
via the shared `src/mc/_leapfrog.js` integrator. Its sibling `HMC` gained full
Euclidean metric adaptation (diagonal + dense mass matrices) under issue #826 /
ADR-0029. Issue #1035 asks NUTS to match that capability, since without it NUTS
mixes worse than HMC on poorly-scaled or correlated targets — a capability
regression for a sampler that sits alongside HMC.

ADR-0029's "Consequences" section explicitly anticipated this: the
accumulate/regularize/factor pattern is "now established twice
(`AdaptiveMetropolis`, `HMC`) with identical conventions, making a third sampler
needing the same machinery (e.g. a future NUTS with mass-matrix support) a
mechanical extension rather than a fresh design." It also recorded that
"extracting a common helper is left as a future refactor, not part of this
change."

Two coupled implementation questions arose, resolved via a design-propose /
design-critique pass:

1. **Where does NUTS get the metric machinery?** Duplicate HMC's ~200 lines of
   accumulator / refresh / momentum-sampling / inverse-metric / kinetic-energy /
   validator code into `nuts.js`, or extract a shared `src/mc/_metric.js` module
   and refactor both HMC and NUTS onto it.

2. **The leapfrog integrator.** Generalize the shared `src/mc/_leapfrog.js` to
   accept an optional `applyInverseMetric` callback (NUTS keeps importing it), or
   give NUTS its own private inline metric-aware `_leapfrog` (mirroring HMC's own
   deliberate inline choice) and delete the now-orphaned shared module.

The no-U-turn criterion is the decisive technical constraint: under a
non-identity metric it must be evaluated on the *velocity* `M⁻¹r`, not the raw
momentum `r` (Betancourt 2017; Stan's `adapt_*_e_nuts`). So the integrator must
surface the velocity it already computes for the position update.

## Decision

**Duplicate HMC's metric machinery into `nuts.js`, and give NUTS its own inline
metric-aware `_leapfrog` that returns `{ x, r, v }`; delete `src/mc/_leapfrog.js`.**

1. **Duplicate, do not extract (this PR).** NUTS gets its own copy of the metric
   accumulator (`_metN`/`_metMean`/`_metM2`; dense `_metCovS` + scratch), refresh,
   `_sampleMomentum`, `_applyInverseMetric`, `_kineticEnergy`, static validators,
   and the `EPS`/`_MAX_DENSE_METRIC_DIM`/`_DENSE_METRIC_REFRESH_INTERVAL`
   constants — structurally identical to `hmc.js`. Extraction into a shared
   `src/mc/_metric.js` is deferred to a follow-up issue: it touches the stable
   HMC sampler (regression risk), sits at the issue's ~400-line production cap,
   would need its own ADR, and only pays off if a *fourth* metric-needing sampler
   appears. This keeps #1035 self-contained (`nuts.js` + tests) and
   independently revertable, matching ADR-0029's explicit deferral.

2. **Inline leapfrog returning velocity.** NUTS's inline
   `_leapfrog(x, r, eps)` performs one signed leapfrog step, applies `M⁻¹` to the
   position update via `_applyInverseMetric`, and returns `{ x, r, v }` where `v`
   is the velocity `M⁻¹r` at the new point. The doubling tree threads the
   endpoint velocities (`vMinus`/`vPlus`) alongside positions/momenta, and
   `_noUTurn` dots `(x⁺−x⁻)` with those velocities. This mirrors HMC's own stance
   (`hmc.js`: each metric-aware gradient sampler owns its integrator, tightly
   coupled to its `_applyInverseMetric`) and avoids the alternative's costs:
   generalizing the shared module would force an expanded `{ x, r, v }` return
   type onto a "textbook identity integrator," leave it with exactly one consumer,
   and falsify HMC's comment explaining why HMC avoids it. The shared
   `src/mc/_leapfrog.js` (module-private, not re-exported, sole caller was NUTS)
   is removed rather than left as dead code.

3. **Diagonal default preserves current behavior bitwise.** `metric` defaults to
   `'diag'` with the effective variance initialized to all-ones, so an un-warmed
   or 1-D NUTS draws `_q.sample() / √1 === _q.sample()` in the same RNG order as
   today — the existing `.seed()` reproducibility and KS tests stay green with no
   change. Metric accumulation opens only after the `_metN ≥ 2·dim` gate, exactly
   as in HMC.

4. **Dual averaging stays uncoupled from metric refresh**, inheriting ADR-0029
   §6's documented limitation verbatim (a WHY comment in `_adjust` points at that
   ADR). NUTS does not silently diverge from HMC here.

`_internal()` gains a `metric` field (plain-array `{ type:'diag', variance }` or
`{ type:'dense', L, D }`, never a cached `Matrix`) alongside `stepSize`, and a
resumed `initialState.internal.metric` is validated on construction — the same
dual-channel validation rule HMC uses.

## Consequences

**Easier:**
- NUTS now samples efficiently from ill-scaled (diagonal metric) and correlated
  (dense metric) targets, closing the documented regression vs. HMC.
- Each metric-aware gradient sampler (HMC, NUTS) owns its integrator inline — one
  coherent convention, no "shared module HMC pointedly avoids" inconsistency.
- The metric API (`config.metric` `'diag'`/`'dense'`, `_internal().metric`) is now
  identical across HMC and NUTS.

**Harder:**
- HMC's and NUTS's metric machinery are now duplicated (a third copy of the
  `AdaptiveMetropolis`/`HMC` Welford-accumulate-regularize-factor pattern).
  Extraction into `src/mc/_metric.js` is a named follow-up, not silently dropped.
- The doubling tree threads two extra endpoint-velocity fields, and `_noUTurn`
  now depends on velocities; a future edit that reverts to dotting raw momentum
  would silently mis-tune trajectory length on ill-scaled targets while still
  passing KS tests on well-scaled ones — a WHY comment guards this.
