# ADR-0041: Process Subclass Names Must Not Contain "Process"

**Date**: 2026-07-25
**Status**: Accepted

## Context

Every `ran.process.Process` subclass is already namespaced under `ran.process` and already extends
`Process`, so the word "Process" in a subclass name is redundant — the type is conveyed by the
namespace and the inheritance chain, not by the class's own identifier. Every subclass follows
this already (`BrownianMotion`, `OrnsteinUhlenbeck`, `BrownianBridge`, `GeometricBrownianMotion`,
`CoxIngersollRoss`, `AR1`, `RandomWalk`) except two: `PoissonProcess` and `CompoundPoissonProcess`,
which redundantly repeat the suffix.

This is a straightforward naming inconsistency, but fixing it renames two public constructors,
which is a breaking change under `CLAUDE.md`'s "Return Value and Error Conventions" /
"Versioning and Changelog" rules (constructor rename), so it requires a deprecation cycle rather
than an in-place rename.

## Decision

Rename `ran.process.PoissonProcess` → `ran.process.Poisson` and
`ran.process.CompoundPoissonProcess` → `ran.process.CompoundPoisson`. Going forward, no
`Process` subclass name may contain the substring "Process".

The rename follows the mandatory deprecation cycle:
- The real implementations move to `src/process/poisson.js` (`Poisson`) and
  `src/process/compound-poisson.js` (`CompoundPoisson`).
- `src/process/poisson-process.js` and `src/process/compound-poisson-process.js` become thin
  deprecated subclasses (`PoissonProcess extends Poisson`, `CompoundPoissonProcess extends
  CompoundPoisson`) that emit a `console.warn` on construction and otherwise behave identically,
  mirroring the existing `ran.dist.Hoyt` → `ran.dist.Nakagami` alias pattern.
- Both old and new names stay exported from `ran.process` and both keep their own subpath export
  (`./process/poisson-process`, `./process/poisson`, etc.) for the duration of the deprecation
  window.
- The old names will be removed in `v1.33.0` (one minor release after the one that introduces this
  warning), per the required hold period.

## Consequences

**Easier:**
- Every `Process` subclass name now follows one consistent rule with no exceptions, matching the
  existing convention documented implicitly by the other seven subclasses.

**Harder:**
- `ran.process.Poisson` and `ran.dist.Poisson` are now two unrelated classes sharing the same bare
  name, distinguished only by namespace/import path — this already applies in spirit to distinct
  `ran.dist`/`ran.process` concepts (e.g. `ran.process.CoxIngersollRoss`'s marginal is a
  `ran.dist.Gamma`), but the identical bare name here is a sharper case: code that imports both
  (e.g. `CompoundPoisson`'s jump distribution can itself be a `ran.dist.Poisson` instance, as
  several existing tests do) must alias one of the two default imports to avoid a name collision.
- Two extra dist bundle files and package.json subpath exports persist until the old names are
  removed in `v1.33.0`.
