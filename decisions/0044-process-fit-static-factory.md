# ADR-0044: Process.fit() as a Static Factory, Closed-Form per Subclass

**Date**: 2026-07-28
**Status**: Accepted

## Context

`ran.process.Process` has no parameter-estimation counterpart to `ran.dist.Distribution.static
fit(data)`. Four subclasses — `BrownianMotion`, `GeometricBrownianMotion`, `OrnsteinUhlenbeck`, and
`CoxIngersollRoss` — have transition densities well-known enough in the literature to admit
closed-form estimators from an observed discrete-time path:

- `BrownianMotion`/`GeometricBrownianMotion`: their one-step transitions (`_next()`) are *exact*
  Gaussian/log-Gaussian with state-independent coefficients, so sample mean/variance of increments
  (or log-returns), divided by `dt`, is the exact MLE — no numerical optimization needed.
- `OrnsteinUhlenbeck`: its `_next()` is already an exact AR(1) recursion
  (`X_{n+1} = a + b*X_n + eps`), so ordinary least squares of `X_{n+1}` on `X_n` recovers `a`, `b`,
  and the residual variance exactly, from which `theta`, `mu`, `sigma` follow by closed-form
  back-substitution. OLS coincides with MLE here because the transition is exactly linear-Gaussian.
- `CoxIngersollRoss`: the true one-step *conditional* transition (given the actual previous path
  value, not the class's hardcoded `x0 = 0`) is a scaled noncentral chi-squared with generally
  non-integer degrees of freedom — a different object from the `Gamma` density already implemented
  as `pdf(x,t)`/`marginal(t)`, which is only valid as the *marginal* because `x0 = 0` eliminates the
  noncentrality term (see ADR-0040's own caveat about this fragility). `ran.dist.NoncentralChi2`
  rounds its `k` to the nearest integer, so it cannot represent CIR's non-integer degrees of
  freedom, and a true conditional MLE would require new noncentral-chi-squared density machinery —
  disproportionate scope for this change. Conditional Least Squares (Overbeck & Rydén 1997)
  supplies a fully closed-form alternative: the conditional mean and conditional variance of
  `X_{n+1} | X_n` are both affine in `X_n`, so two rounds of OLS (the first identical in structure
  to the `OrnsteinUhlenbeck` case, the second regressing squared first-stage residuals on `X_n`)
  recover `kappa`, `theta`, `sigma` without touching the noncentral chi-squared density at all. This
  is not exact MLE (it matches only the first two conditional moments), but it needs no new special
  function, no optimizer, and stays consistent with the other three processes' closed-form-only
  contract.

Two API-shape questions needed resolving before implementation: (1) should `fit` be a static
factory (`Cls.fit(path, dt)`, mirroring `Distribution.static fit(data)`) or an instance method
reading an existing instance's own `dt`; (2) should `Process` gain a throw-by-default hook the way
`marginal(t)` did in ADR-0040, and if so, should that hook be static or instance — every existing
`Process` hook (`covariogram`, `mean`, `variance`, `pdf`, `marginal`) is an instance method.

## Decision

`Process` gains a new **public static** method, `fit(path, dt = 1)`, added to the abstract base
class as a throw-by-default hook: `throw Error('Process.fit() is not implemented')`. This is the
first *static* throw-by-default hook on `Process` — every prior hook (`marginal` included) is an
instance method because it queries an already-parameterized process's own analytical properties.
`fit()` is different in kind: it has no meaningful "existing instance" to query — its whole purpose
is to produce a calibrated instance *from* data the caller does not yet have a process for — so it
follows `Distribution.static fit(data)`'s shape instead, not its sibling hooks'. `dt` defaults to
`1`, mirroring every constructor in this hierarchy (`BrownianMotion(mu, sigma, dt = 1)`, etc.).

`BrownianMotion`, `GeometricBrownianMotion`, and `OrnsteinUhlenbeck` override `static fit(path, dt)`
with the exact closed-form MLE/OLS estimators described above and return `new Cls(...params, dt)`.
`CoxIngersollRoss` overrides it with the two-stage Conditional Least Squares estimator; its JSDoc
and the CHANGELOG entry both name this explicitly as CLS, not MLE, so callers are not misled into
assuming asymptotic efficiency guarantees the class does not provide. Other `Process` subclasses
(`AR1`, `PoissonProcess`, `CompoundPoissonProcess`, `RandomWalk`, `BrownianBridge`) are left on the
base class's throwing default — this ADR does not require every process to implement `fit()`, only
that those with a tractable closed-form estimator do, mirroring ADR-0040's partial rollout of
`marginal(t)`.

## Consequences

**Easier:**
- Callers with an observed path and a known process family get a calibrated instance in one call
  (`OrnsteinUhlenbeck.fit(path, dt)`), with no need to construct a throwaway instance first.
- No new numerical machinery anywhere in this change — every estimator is closed-form arithmetic
  (sample moments or OLS), reusing the same formulas already coded into each class's `mean()`,
  `variance()`, and `_next()`. `CoxIngersollRoss.fit()` in particular avoids the noncentral
  chi-squared machinery a true conditional MLE would require.
- Future processes with a tractable closed-form estimator follow an established minimal pattern:
  override the static hook, return `new Cls(...estimated, dt)`.

**Harder:**
- The static shape is inconsistent with every other `Process` hook, which is an instance method.
  A future contributor scanning `_process.js` should not assume all hooks share one calling
  convention; the WHY comment on `Process.fit()` exists specifically to head this off.
- `CoxIngersollRoss.fit()`'s CLS estimator is statistically *consistent* but not maximally
  *efficient* — it matches conditional moments, not the full likelihood. It also inherits the
  `_next()` Euler-Maruyama discretization's own approximation error at large `dt`, since CLS is fit
  against the exact continuous-time conditional moments, not the discretization actually used to
  simulate the path. If a future issue adds a true noncentral-chi-squared conditional MLE, this CLS
  path is a fallback/initial-guess source, not something to delete outright — some callers may
  prefer avoiding a numerical optimizer entirely.
- The second-stage OLS in CIR's CLS estimator can produce a negative fitted `sigma^2` for short or
  pathological paths; the implementation must throw rather than silently constructing an invalid
  instance.
