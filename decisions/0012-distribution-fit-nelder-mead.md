# ADR-0012: Distribution.fit() Static MLE Method via Nelder-Mead + _fitInit Hook

**Date**: 2026-05-26
**Status**: Superseded by [ADR-0016](0016-distribution-fit-powell-and-exact-mle.md)

## Context

The library provides `lnL()`, `aic()`, and `bic()` for evaluating goodness-of-fit at a given
parameter point, but no way to *find* the maximum-likelihood parameter estimates. Users who want
to fit a distribution to data are forced to do manual parameter tuning outside the library.

Adding a generic `fit()` method requires three choices:

1. **Optimizer**: gradient-free vs gradient-based. Because distribution PDFs are sometimes
   discontinuous or non-differentiable in their parameters, and because `k ≤ 6` for all
   distributions in the library, a derivative-free simplex method (Nelder-Mead) is appropriate.

2. **Initial parameter discovery**: `static fit(data)` cannot know `k` or the starting point
   without an instance. Three options were evaluated:
   - Auto-discovery via try-catch in `fit()` directly — fragile, fails silently for non-scalar
     constructors (Hyperexponential, Categorical) and zero-param distributions.
   - Require init params from caller — violates the desired `Normal.fit(data)` API.
   - `static _fitInit(data)` hook — follows the existing `_pdf`/`_cdf`/`_generator` override
     pattern; the base-class default uses `this.length` (constructor arity) plus a random
     positive-value retry loop so the fallback works for every scalar-constructor distribution
     in the library; subclasses override with method-of-moments estimates when needed.

3. **TypeScript return type**: `InstanceType<T>` via `@template`/`@this` JSDoc is poorly
   supported by tsc in `--allowJs --emitDeclarationOnly` mode and is known to silently fall
   back to the base type. Accepting `Distribution` as the static return type is simpler and
   equally correct at runtime.

## Decision

1. **Add `static _fitInit(data)` to `Distribution`** as a protected hook. The base-class
   default takes the parameter count from `this.length` (the constructor's declared arity, which
   JavaScript exposes as a property on the class itself) and draws random positive values in
   `(0, 5)` until a vector validates against the distribution's constraints (up to 500 tries).
   All-ones was the initial choice but empirically fails for ~22% of distributions (ordering
   constraints like `a < b` on `Uniform`/`Bates`/`Triangular`, probability bounds on
   `Binomial`/`NegativeBinomial`, integer constraints on `Zeta`, etc.); random retries succeed
   for every distribution with a scalar constructor (128/128 in the library). Distributions
   that need a better starting point (e.g., Normal: `[mean, std]`) override this method.
   Distributions with non-scalar constructors (Hyperexponential, Categorical) or undefined MLE
   override and throw clearly.

2. **Add `static fit(data)` to `Distribution`** that calls `this._fitInit(data)`, minimises
   `-lnL(data)` via Nelder-Mead, and returns `new this(...bestParams)`.

3. **Add `nelderMead(f, x0, opts)` to `src/algorithms/nelder-mead.js`**, exported via
   `src/algorithms/index.js`. Standard coefficients α=1, γ=2, ρ=0.5, σ=0.5.

4. **TypeScript return type is `Distribution`**. Callers needing the specific subclass type
   cast at the call site. This follows the existing pattern of `save()`/`load()` and avoids
   unreliable `@template`/`@this` JSDoc on static methods.

## Consequences

- **Easier**: Users can write `Normal.fit(data)` to obtain MLE parameter estimates.
- **Easier**: Per-distribution `_fitInit` overrides (method-of-moments init, closed-form MLE
  in the future) follow the same pattern as `_pdf`/`_cdf` overrides — one issue per
  distribution per the CLAUDE.md abstract-method-first rollout convention.
- **Harder**: Distributions with non-scalar constructors (Hyperexponential, Categorical) cannot
  use the generic `fit()` until they implement their own `_fitInit`. The base-class probe will
  throw rather than silently return a wrong result.
- **Changed**: `src/algorithms/index.js` gains a new export (`nelderMead`). The algorithm is
  marked `@private` so it does not appear in user-facing docs.
