# ADR-0017: Penalised likelihood for Beta-family `fit()` — `_fitPenalty` hook

**Date**: 2026-06-03
**Status**: Accepted

Extends [ADR-0016](0016-distribution-fit-powell-and-exact-mle.md) (Powell optimizer for `fit()`).

## Context

ADR-0016 introduced a non-finite log-likelihood rejection guard in `Distribution.fit()`:

```javascript
return Number.isFinite(v) ? v : Infinity
```

That guard prevents the Powell optimizer from walking into the *exact* singularity at a shape
parameter boundary (e.g. `alpha = 0` for the Beta distribution). ADR-0016 explicitly noted that
"a constrained or penalised optimizer… would be needed to fit such models rigorously" (see the
Consequences section). Issue #625 addresses that gap.

The remaining problem: for Beta-type distributions, the log-likelihood is *finite but very large*
for near-boundary parameters such as `alpha ≈ 0.001`. The optimizer sees these near-singular
parameter vectors as valid, deep minima of the negative-log-likelihood objective, and converges
to them rather than to the consistent interior MLE.

## Decision

### 1. Add a `static _fitPenalty(dist)` hook to `Distribution`

The base-class default returns `0` (no penalty — pure MLE, unchanged for all existing
distributions). A subclass overrides it to return an additive penalty that is subtracted from the
penalised log-likelihood (equivalently, added to the minimisation objective). The argument is the
already-constructed distribution instance, so subclasses can read `dist.p.*` regardless of the
constructor parameter ordering.

```javascript
static _fitPenalty (dist) { return 0 }  // default: no-op
```

`fit()` incorporates the penalty by constructing the instance once:

```javascript
const inst = new Cls(...params)
const v = -inst.lnL(data) + Cls._fitPenalty(inst)
```

### 2. Override `_fitPenalty` in `Beta` with a Jeffreys-like log-barrier

The penalty receives the already-constructed distribution instance (not the raw params vector),
so it can safely read `dist.p.alpha` and `dist.p.beta` regardless of the subclass's constructor
parameter ordering.

```javascript
static _fitPenalty (dist) {
  // Jeffreys-like log-barrier on the underlying shape parameters.
  // See decisions/0017-beta-fit-penalty.md.
  const { alpha, beta } = dist.p
  return -0.5 * (Math.log(alpha) + Math.log(beta))
}
```

No guard for `alpha > 0 && beta > 0` is needed: if a params vector would produce invalid
alpha/beta the constructor throws and `fit()`'s `catch` block returns `Infinity` already.

The coefficient `c = 0.5` corresponds to a Jeffreys-like improper prior `π(α,β) ∝ (αβ)^{-1/2}`.
It creates a log-barrier at `α → 0⁺` and `β → 0⁺`:

| `alpha` | penalty added to objective |
| ------- | -------------------------- |
| 0.001   | +3.45                      |
| 0.01    | +2.30                      |
| 0.1     | +1.15                      |
| 1.0     | 0                          |
| 10.0    | −1.15                      |

The barrier grows without bound as `alpha → 0`, making the near-singular "optimum" unreachable
for any finite-lnL data set.

The `fit()` objective is updated to construct the instance once and pass it to the penalty:

```javascript
const inst = new Cls(...params)
const v = -inst.lnL(data) + Cls._fitPenalty(inst)
return Number.isFinite(v) ? v : Infinity
```

### 3. Inheritance carries the penalty to all Beta subclasses

All Beta subclasses (`BetaRectangular`, `BetaPrime`, `F`, `R`, `PERT`, `BaldingNichols`) call
`super(alpha, beta)` in their constructors, which causes `Beta` to store `this.p.alpha` and
`this.p.beta`. The penalty reads those stored values, so it is correct regardless of each
subclass's constructor parameter ordering. No subclass needs to override `_fitPenalty`.

The instance-based signature avoids the hazard present in a raw-params approach: `R` has a
single constructor param `c` (with `alpha = beta = c/2` stored by `super`), so a params-based
penalty reading `params[1]` would produce `NaN`. Reading `dist.p.beta` is always safe.

### 4. This is a MAP estimate, not MLE, for Beta-family distributions

The penalised objective maximises `lnL(data) + c·(log α + log β)`, which is the posterior
log-density under the Jeffreys-like prior. For typical sample sizes (n ≥ 30) and well-interior
solutions (α, β ≫ 1), the MAP and MLE coincide to well within statistical noise (`O(1/√n)`).
The difference is only meaningful near the singularity, where it is intentional.

## Consequences

- **Better**: `fit()` on Beta, BetaRectangular, and BetaPrime consistently returns interior
  parameter estimates rather than near-degenerate singularity-adjacent fits.
- **Easier**: The `_fitPenalty` hook is extensible — any future distribution with a known
  boundary singularity can override it without touching `fit()` or the Powell optimizer.
- **Changed**: `fit()` for Beta-family distributions is now MAP rather than pure MLE. The
  returned parameters differ slightly from the unconstrained MLE for any data set where the
  unconstrained MLE is near a boundary — that is, the difference is largest exactly where the
  old behaviour was wrong.
- **Unchanged**: All other distributions use the default `_fitPenalty` returning `0`, so their
  `fit()` behaviour is identical to ADR-0016.
- **Out of scope**: Discrete Beta-family distributions (`BetaBinomial`, `BetaNegativeBinomial`)
  have different param orderings and inheritance chains; they are not covered by this ADR.
