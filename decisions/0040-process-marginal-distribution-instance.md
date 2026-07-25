# ADR-0040: Process.marginal(t) Returns a Distribution Instance

**Date**: 2026-07-25
**Status**: Accepted

## Context

`ran.process.Process` and its subclasses already expose `mean(t)`, `variance(t)`, and `pdf(x, t)`
as separate analytical methods, but nothing on the marginal distribution beyond those three
moments/density — no `quantile()`, `hazard()`, `survival()`, `likelihood()`, `aic()`, `bic()`, or
`test()` at a fixed time `t`. `ran.dist.Distribution` already implements all of those generically
from `_pdf`/`_cdf` (`decisions/0004-*` and the base class itself), and several processes' marginals
are already known closed-form members of `ran.dist`: `BrownianMotion`/`OrnsteinUhlenbeck`/
`BrownianBridge` are Gaussian, `GeometricBrownianMotion` is log-normal, and `CoxIngersollRoss`
(started at `x0 = 0`, which every current subclass hardcodes) collapses to a plain Gamma — the
noncentral-chi-squared transition density's noncentrality term vanishes when the conditioning
state is `0`, leaving exactly the Gamma shape/scale already derived for `CoxIngersollRoss.pdf()`.

The choice was between (a) duplicating the Distribution API's numerical machinery (quadrature,
root-finding for quantiles, etc.) directly on `Process`, or (b) adding one method that returns an
existing `Distribution` instance and delegating everything else to code that already exists,
is already tested, and is already numerically hardened.

## Decision

`Process` gains a new public instance method, `marginal(t)`, added to the abstract base class as a
throw-by-default hook (matching the existing `covariogram`/`mean`/`variance`/`pdf` pattern) that
subclasses override. Each of the five processes with a known closed-form marginal —
`BrownianMotion`, `OrnsteinUhlenbeck`, `BrownianBridge`, `GeometricBrownianMotion`,
`CoxIngersollRoss` — implements it by constructing and returning the appropriate `ran.dist`
instance from parameters already derived by that process's own `mean()`/`variance()`/`pdf()`
formulas; no new numerical algorithm is introduced anywhere in this change.

`marginal(t)` throws `Error` for any `t` where the marginal is not a genuine continuous
distribution rather than returning some sentinel: `t <= 0` for all five (the process has not yet
evolved away from its deterministic initial state), and additionally `t >= T` for
`BrownianBridge` (pinned to a point mass at the terminal time). This follows
`decisions/0015-return-value-and-error-conventions.md`'s throw-on-structurally-invalid-input rule
— a `Normal(mu, 0)` is not constructible (the `Distribution` base class validates `sigma > 0`), so
there is no NaN-typed or zero-variance object to hand back; the caller has asked for something
that does not exist at that `t`, not for an in-domain answer that happens to be indeterminate.

Other `Process` subclasses without a closed-form marginal (`AR1`, `PoissonProcess`,
`CompoundPoissonProcess`, `RandomWalk`) are left on the base class's throwing default; this ADR
does not require every process to implement `marginal()`, only that those which can, do.

## Consequences

**Easier:**
- Every process with a closed-form marginal gains the full `Distribution` API (`quantile()`,
  `hazard()`, `survival()`, `likelihood()`, `aic()`, `bic()`, `test()`) for free, with zero new
  numerical machinery — the returned object is a real `Normal`/`LogNormal`/`Gamma` instance.
- Future processes with a closed-form marginal follow an established, minimal pattern: construct
  the corresponding `Distribution` from already-derived `mean()`/`variance()`/`pdf()` parameters.

**Harder:**
- `marginal(t)` returning `null`/`undefined` was rejected outright (per ADR-0015, `undefined` is
  never an error sentinel), so every override must throw for its own invalid-`t` region instead of
  returning a placeholder — a small extra branch per subclass, but consistent with the rest of the
  codebase's domain-validation convention.
- If `CoxIngersollRoss` ever gains a non-zero configurable `x0`, `marginal(t)` must be revisited:
  the Gamma collapse specifically depends on the process always starting at `0`.
