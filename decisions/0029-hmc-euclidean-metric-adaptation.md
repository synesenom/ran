# ADR-0029: HMC Euclidean Metric (Mass Matrix) Adaptation

**Date**: 2026-07-16
**Status**: Accepted

## Context

`HMC` (`src/mc/hmc.js`) implicitly uses an identity mass matrix: momenta are
drawn from `N(0, I)`, the kinetic energy term is `½‖p‖²`, and the leapfrog
position update is `x ← x + ε·r`. This is exactly Neal (2011) §4.1's
diagonal-with-equal-scales case, which "provides information only about the
different scales of the variables, not their correlation" — HMC struggles on
targets whose parameters span different orders of magnitude or are strongly
correlated, because a single shared step size cannot simultaneously suit a
poorly-scaled or correlated posterior's fast and slow directions.

Issue #826 asks for Euclidean metric adaptation: estimate a mass matrix `M`
online during warm-up (`M ≈ Cov(θ)⁻¹`), use it in the kinetic energy
(`½ pᵀM⁻¹p`) and momentum resampling (`p ~ N(0, M)`), default to a diagonal
`M` (variance-only), and support a `metric: 'dense'` option using the full
covariance matrix factored via `Matrix.ldl()`.

`ranjs` already has a structurally identical precedent: `AdaptiveMetropolis`
(`src/mc/adaptive-metropolis.js`) accumulates an online covariance estimate
(a multivariate Welford recurrence), regularizes it with `EPS * I` before
factoring, decomposes it via `Matrix.ldl()`, and builds a square-root
transform for one-matvec-per-iteration sampling. `Matrix` itself
(`src/la/matrix.js`) has no solve/inverse/triangular-substitution method —
only the unpivoted `ldl()` — so any use of `M⁻¹p` must hand-roll
forward/back substitution against the LDL factors.

Prior ADRs constrain the design space:
- ADR-0020 fixes the `_iter`/`_adjust`/`_internal` subclass contract:
  adaptation logic lives in `_adjust`, which only runs during warm-up.
- ADR-0023 pins the base class's own accumulators (Welford, autocorrelation,
  acceptance) as contractual; a new sampler must not read or repurpose them,
  and any `dim × dim` accumulator must be weighed against
  `_MAX_ACCUMULATOR_BYTES`, which today only bounds `dim × maxLag`
  allocations, not `dim²` ones.
- ADR-0024 fixes warm-up as a flat `maxBatches × 10,000`-iteration loop with
  no convergence-gated early stop — ruling out replacing it with a
  Stan-style multi-phase windowed adaptation schedule.
- A prior solution note
  (`solutions/tooling/2026-07-15-1330-adaptive-metropolis-ran-la-matrix-dts-leak.md`)
  established that no publicly-reachable class may cache a `Matrix`/`Vector`
  instance as an instance field, since it leaks an unresolvable type into
  the generated `.d.ts`.

A design-propose/design-critique pass considered three options: (1) HMC owns
its own Welford-style accumulator, mirroring `AdaptiveMetropolis` exactly
(own state, `EPS * I` regularization, refresh gated at `n ≥ 2·dim`, dual
averaging left independent); (2) the same accumulator but with Stan's
`n/(n+5)` shrinkage formula, periodic (not per-iteration) refresh, and a
dual-averaging reset on every metric refresh; (3) reusing the base class's
already-private `_welford` accumulator for the diagonal case to save ~20
lines. Both agents converged independently on option (1) with high
confidence — option (2) bundles three simultaneous departures from
established convention (a second regularization idiom, a new config knob,
and dual-averaging/metric coupling) whose correctness depends on the full
windowed schedule ADR-0024 already defers, and option (3) couples HMC to a
base-class-private field ADR-0023 treats as contractual, for a marginal
savings.

## Decision

`HMC` gains its own mass-matrix adaptation, structurally mirroring
`AdaptiveMetropolis`, with three deviations the critique required beyond a
literal mirror:

1. **Own accumulator, not the base class's.** `HMC` maintains a dedicated
   Welford-style accumulator (`_metN`/`_metMean`/`_metM2` for the diagonal
   case; also `_metCovS`/scratch deltas for the dense case) entirely private
   to `hmc.js`. It does not read or modify `MCMC`'s `_welford` — consistent
   with `AdaptiveMetropolis` building its own `_covMean`/`_covS` despite the
   base class already tracking per-dimension mean/variance, and avoiding a
   coupling ADR-0023 was written to make difficult.

2. **`EPS * I` regularization**, matching `AdaptiveMetropolis`'s existing
   constant and formula, applied before every `Matrix.ldl()` call (which has
   no pivoting or singularity guard of its own).

3. **Diagonal default, dense opt-in.** Diagonal `M` needs no factorization
   at all — sampling and `M⁻¹p` are both elementwise (`p_i = √varianceᵢ·zᵢ`,
   `[M⁻¹p]ᵢ = pᵢ/varianceᵢ`). Dense `M` is factored via `Matrix.ldl()`;
   `M⁻¹p` (needed every leapfrog substep) and momentum sampling `p ~ N(0,M)`
   (needed once per iteration) are both computed against the plain-array
   `L`/`D` factors via hand-written forward/back substitution, confined to
   private instance methods in `hmc.js`. This is textbook linear algebra,
   not a rank-1 update algorithm, so it does not encroach on the issue's
   "online rank-1 Cholesky updates" out-of-scope item. No solve/inverse
   method is added to `Matrix`'s public surface — expanding that class's API
   is out of this issue's scope.

4. **Dense refresh is batched, not per-iteration.** `Matrix.ldl()` is
   `O(dim³)`. Refreshing the factored dense metric on every `_adjust()` call
   (as `AdaptiveMetropolis` does) would run an `O(dim³)` operation on every
   one of up to `maxBatches × 10,000` warm-up iterations. The covariance
   accumulator still updates every iteration (`O(dim²)`, unavoidable for a
   dense estimate), but the LDL refresh itself is capped to a fixed,
   non-configurable interval of iterations (a private `HMC` constant,
   decoupled from `_mcmc.js`'s own internal batch size so a future change to
   one cannot silently change the other's behavior) — no new *user-facing*
   config option is introduced. The diagonal case has no such cost
   (`O(dim)` refresh) and continues to refresh every iteration once its
   `n ≥ 2·dim` gate opens, matching `AdaptiveMetropolis`'s cadence.

5. **A stricter guard on `metric: 'dense'`'s `dim × dim` allocation.**
   `_validateCombinedFootprint` (`_mcmc.js:399-403`) bounds only
   `dim × maxLag`; it does not catch a dense covariance accumulator, which
   at `_MAX_DIM = 10000` would allocate ~800 MB. `HMC`'s own dense-metric
   validation adds an explicit `dim` cap for `metric: 'dense'` construction,
   independent of the base class's existing check.

6. **Dual averaging is deliberately left independent of metric
   refresh — a documented limitation, not a silent gap.** The literature
   (Hoffman & Gelman 2014; Betancourt 2017; Stan's
   `adapt_diag_e_nuts.hpp`, which re-derives the step size and restarts
   dual averaging every time its metric window closes) treats stale
   step-size statistics under a changed metric as invalid, since the
   optimal step size depends on the metric's local curvature. Implementing
   that correctly requires the three-phase windowed schedule (fixed-metric
   fast interval → growing metric-estimation windows with restarts →
   metric-frozen fast interval) that ADR-0024 already ruled out replacing
   `warmUp()`'s flat batch loop with. Bolting on a dual-averaging reset
   without that surrounding schedule (option 2, above) would leave the step
   size perpetually re-converging with no phase that lets it finish. `HMC`
   therefore runs dual averaging exactly as before, oblivious to metric
   changes; this is mitigated by dual averaging's exponentially-decaying
   weighting (`t^{-κ}`, `hmc.js:128`) fading out stale statistics and by the
   metric itself changing gradually (a smoothed running estimate, not a
   discrete jump), but it is a known, incomplete piece of literature-correct
   behavior. `_adjust()` carries a WHY comment pointing at this ADR so a
   future contributor does not "fix" the missing reset without first
   reading why it was deferred.

`_internal()` gains a `metric` field (plain arrays only — a diagonal
variance vector, or `{ L, D }` plain-array factors for dense — never a
cached `Matrix` instance) alongside the existing `stepSize`/`pathLength`,
following the "serialize effective state, not adaptation counters"
convention already used for both of those fields and for
`AdaptiveMetropolis`'s `proposal`. The resumed `initialState.internal.metric`
is validated on construction, matching the dual-channel validation rule from
`solutions/correctness/2026-07-15-1230-hmc-resumed-internal-state-validation-gap.md`.

## Consequences

**Easier:**
- HMC can now sample efficiently from targets with very different
  per-dimension scales (default diagonal metric) or with strong linear
  correlations (opt-in dense metric), without requiring the caller to
  manually reparameterize the target.
- The accumulation/regularization/factoring pattern is now established
  twice in the codebase (`AdaptiveMetropolis`, `HMC`) with identical
  conventions, making a third sampler needing the same machinery
  (e.g. a future NUTS with mass-matrix support) a mechanical extension
  rather than a fresh design.

**Harder:**
- `HMC` duplicates `AdaptiveMetropolis`'s multivariate Welford recurrence
  rather than sharing it; extracting a common helper is left as a future
  refactor, not part of this change.
- The dense case's batched-refresh cadence (once per warm-up batch) is a
  new pattern distinct from `AdaptiveMetropolis`'s per-iteration refresh;
  future readers must understand *why* the two differ (dense-metric
  factorization cost) rather than assuming the codebase has one uniform
  refresh cadence for this class of adaptation.
- Dual-averaging step-size adaptation is not literature-optimal in the
  presence of metric changes. A future issue implementing Stan-style
  windowed warm-up (if ADR-0024 is ever superseded) should revisit this and
  add the dual-averaging reset this ADR explicitly defers.
