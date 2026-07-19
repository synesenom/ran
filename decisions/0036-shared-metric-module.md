# ADR-0036: Shared Euclidean-metric module for gradient MCMC samplers

**Date**: 2026-07-19
**Status**: Accepted

## Context

`ran.mc.HMC` (`src/mc/hmc.js`) and `ran.mc.NUTS` (`src/mc/nuts.js`) each carried a near-identical
~200-line copy of the Euclidean mass-matrix ("metric") adaptation machinery: the Welford
accumulator over sampled positions, the effective-metric refresh (diagonal variance or dense LDL
factorization), momentum sampling from `N(0, M)`, `M⁻¹` application, kinetic energy, the static
validators for `config.metric` and resumed metric/accumulator state, and the
`EPS`/`_MAX_DENSE_METRIC_DIM`/`_DENSE_METRIC_REFRESH_INTERVAL` constants.

This duplication was deliberate, not accidental. ADR-0029 (HMC metric adaptation) recorded that
"extracting a common helper is left as a future refactor" and anticipated a future metric-aware
NUTS as "a mechanical extension." ADR-0034 (NUTS metric adaptation, #1035) then duplicated the
machinery to keep that PR self-contained and independently revertable, naming this extraction as an
explicit follow-up (#1041). With the pattern established three times (`AdaptiveMetropolis`, `HMC`,
`NUTS`), a shared module is warranted.

The `ran.la.Matrix` `.d.ts` leak
(`solutions/tooling/2026-07-15-1330-adaptive-metropolis-ran-la-matrix-dts-leak.md`) constrains the
design: no `Matrix`/`Vector` instance may be stored as a field on any class reachable from
`src/index.js`, because `tsc --allowJs --declaration` would emit an unresolvable `ran.la.Matrix`
type. The existing samplers avoid this by building the `Matrix` transiently inside `_refreshMetric`;
the shared module must preserve that discipline.

## Decision

Extract the shared machinery into a new **unexported** module `src/mc/_metric.js` that exports
**free functions operating on a plain-object metric-state bag**, not a class:

- A factory `createMetricState({ type, dim, resumedMetric, resumedAccumulator })` returns a plain
  object holding the accumulator and effective-metric fields (all plain numbers/arrays).
- Free functions mutate/read that state: `updateAccumulator`, `refreshMetric`, `sampleMomentum`
  (receives the sampler's `Normal` instance as an argument, never a field), `applyInverseMetric`,
  `kineticEnergy`, `snapshotMetric`, `snapshotAccumulator`.
- Validators take a leading `name` string (`'HMC'`/`'NUTS'`) so thrown-error prefixes are
  reproduced verbatim: `validateMetric`, `validateDenseMetricDim`, `validateResumedMetric`,
  `validateResumedMetricAccumulator`.
- Constants `EPS`, `MAX_DENSE_METRIC_DIM`, `DENSE_METRIC_REFRESH_INTERVAL` become named exports.
- `refreshMetric` builds the regularized covariance `Matrix` as a **method-body local**, extracts
  `L`/`D` to plain arrays, and never retains it — the state bag stores plain arrays only.

`_metric.js` is `_`-prefixed and is **not** added to `src/mc/index.js`, mirroring `_mcmc.js` and
`_leapfrog.js`, so it never enters the public `.d.ts` graph. It imports `MCMC` from `_mcmc.js` for
the shared resume/validation helpers (`_resolveResumedField`, `_validateNonNegativeInteger`,
`_validateFiniteVector`, `_validateFiniteMatrix`); since `_mcmc.js` imports nothing from `src/mc/`,
the dependency graph stays acyclic.

Rejected alternatives: (2) free functions reaching into the sampler `this` — contradicts the
"plain-object state" intent and creates a fragile implicit field contract; (3) a `_Metric` class
held as `this._metric` — risks re-triggering the `.d.ts` inference leak with a nominal type from an
unexported module.

Each sampler keeps its own inline `_leapfrog` (HMC's takes `pathLength` steps and returns `{x, r}`;
NUTS's takes one signed step and returns `{x, r, vel}`), consistent with ADR-0029/ADR-0034 — the
integrator is sampler-specific and out of scope for this extraction.

## Consequences

- **Easier**: A fourth metric-aware sampler becomes a one-line wiring change against a single,
  documented state-bag contract. Fixing a bug in the accumulator/refresh/momentum logic now touches
  one file, not three. ~200 lines of duplication removed from each sampler.
- **Harder / to watch**: The state-bag field names are the single source of truth; `snapshotMetric`
  / `snapshotAccumulator` must emit the exact external key names (`metN`, `metMean`, `metM2`,
  `metCovS`, and the `{ type, L, D }` / `{ type, variance }` shapes) that `state()` round-trips and
  the tests assert on. The `.d.ts`-safety discipline (no `Matrix`/`Vector` field) is now a property
  of `_metric.js` that any future edit must preserve; `npm run build && npm run typecheck` remains
  the mandatory gate for changes here.
- **Behavior**: None. This is a pure refactor — arithmetic, PRNG draw order, and serialized state
  are byte-for-byte identical, verified by the unchanged HMC and NUTS test suites.
