# ADR-0018: Continuous Reparametrized Subclasses — Natural Parameters via `this.p`

**Date**: 2026-06-07
**Status**: Accepted

## Context

ADR-0009 and ADR-0014 establish the convention that `this.p` holds only natural (user-facing)
parameters and `this.c` holds speed-up constants and internal state. ADR-0014 applied this
convention to the discrete Categorical family. Nine continuous subclasses — `Chi2`, `DoubleWeibull`,
`Erlang`, `HalfNormal`, `LogCauchy`, `MaxwellBoltzmann`, `Rayleigh`, `Slash`, `StudentZ` — never
override `this.p` after calling `super()`, so `params()` exposes the parent's reparametrized state
(e.g., `Rayleigh(1.5).params()` → `{ lambda:1, lambda2:2.12, k:2 }` instead of `{ sigma:1.5 }`).

Two questions arise:

**Bug fix vs. breaking change**: `params()` was explicitly documented to return "natural
(user-facing) params only" from its inception (ADR-0014). The wrong behavior was never the
documented contract; callers that relied on `dist.params().alpha` for a `Chi2` were depending on an
undocumented, misbehaving implementation detail. The correct return shape was always `{ k }`.

**Method re-implementation strategy**: Several subclasses delegate computation to `super._xxx()`
methods that read `this.p`. After overriding `this.p` to natural params, those calls break. The
available strategies are: (A) call the underlying algorithm function directly with values from
`this.c`, (B) inline the parent's math, or (C) temporarily swap `this.p`. Option A is DRY and
already used in the codebase (e.g., `MaxwellBoltzmann` imports `gammaLowerIncompleteInv`).

## Decision

1. **Bug fix framing**: The `.params()` return-shape change is a bug fix, not a breaking change.
   No deprecation cycle is required. The documented contract has always been "natural params only";
   returning parent-internal keys violated that contract from inception.

2. **Each of the 9 subclasses overrides `this.p`** in its constructor (after `super()`) with its
   own natural parameters. Parent-derived values that methods still need move into `this.c` via
   `Object.assign(this.c, { ... })`.

3. **Methods that previously called `super._xxx()` are re-implemented** to call the underlying
   algorithm functions (imported from `../special`, `../algorithms`, or sibling `_xxx.js` helpers)
   with values from `this.c`, rather than delegating to parent methods that read `this.p`. Inlining
   parent math is acceptable only for trivial one-liners where the algorithm function would not add
   clarity.

4. **Decomposition**: One PR per inheritance family to stay within the ~400-line cap:
   - **Phase 1 — ADR (this document)**
   - **Phase 2 — Gamma family**: `Chi2`, `Erlang`, `MaxwellBoltzmann`
   - **Phase 3 — Weibull family**: `Rayleigh`, `DoubleWeibull`
   - **Phase 4 — Normal family**: `HalfNormal`, `Slash`
   - **Phase 5 — Cauchy family**: `LogCauchy`
   - **Phase 6 — StudentT family**: `StudentZ`

## Consequences

- **`params()` returns only natural parameters for all 9 corrected distributions.** Callers
  using `dist.params()` for display or round-trip fit tests now receive the correct keys.
- **`save()`/`load()` round-trips correctly**: `save()` serializes `this.p` (natural params) and
  `this.c` (derived values); `load()` restores both; methods reading `this.c` work without
  special-casing.
- **`this.k` and `Object.keys(this.p).length` now agree** for all corrected distributions.
- **Methods work identically at runtime**: The algorithm functions called directly produce the same
  numerical results as the previous `super._xxx()` delegation.
- **Existing tests continue to pass**: PDF/CDF/quantile/sample/moment correctness is unchanged
  because the underlying math is not altered — only where the parameters are stored.
