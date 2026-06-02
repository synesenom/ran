# ADR-0014: Categorical Family — Split Lookup State into `this.c`, Expose Natural Parameters via `this.p`

**Date**: 2026-05-30
**Status**: Accepted

## Context

`Categorical` stores `{ n, weights, min }` in `this.p`. `n` and `min` are internal lookup-table state required by `_generator`, `_pdf`, and `_cdf`; `weights` is the actual natural parameter. All nine subclasses (`Bernoulli`, `Binomial`, `Hypergeometric`, `Soliton`, `Zipf`, `ZipfMandelbrot`, `BetaBinomial`, `NegativeHypergeometric`, `Rademacher`) call `super(weights, min)` without overriding `this.p`, so they expose `{ n, weights, min }` to callers instead of their own natural parameters.

ADR-0009 documents the convention that `this.p` holds natural (user-facing) parameters, and `this.c` holds speed-up constants and internal state. The Categorical family violates this by placing internal state in `this.p`.

## Decision

1. In `Categorical`, move `n` and `min` from `this.p` into `this.c = { n, min }`. Keep `weights` in `this.p = { weights }` — it is the natural parameter for `Categorical` itself. Update `_generator`, `_pdf`, and `_cdf` to read from `this.c.n` and `this.c.min`.

2. Each subclass overrides `this.p` after its `super()` call with its own natural parameters:
   - `Bernoulli`: `{ p }`
   - `Binomial`: `{ n, p }`
   - `Hypergeometric`: `{ N, K, n }`
   - `Soliton`: `{ N }`
   - `Zipf`: `{ s, N }`
   - `ZipfMandelbrot`: `{ N, s, q }`
   - `BetaBinomial`: `{ n, alpha, beta }`
   - `NegativeHypergeometric`: `{ N, K, r }`
   - `Rademacher`: `{}`

3. A public `params()` method is added to `Distribution` as a stable accessor for `this.p`, so external code reads `dist.params()` rather than `dist.p` directly.

## Consequences

- **Easier**: `dist.params()` returns the named statistical parameters the user passed in, not internal table metadata. Downstream code (demos, fit display, user-facing APIs) can reliably use `.params()`.
- **Harder**: Nothing — `_generator`, `_pdf`, and `_cdf` still have access to `n`/`min` through `this.c`. `save()`/`load()` serializes `this.p` and `this.c` separately; both are correctly restored.
- **Consistent**: Aligns the Categorical family with ADR-0009 (`this.p` = natural parameters) and ADR-0008 (`this.c` = named object).
- **`Bernoulli._q` fix**: The method currently reads `this.p.weights[0]` for the CDF at k=0; after the refactor it must read `this.pdfTable[0]` instead.
