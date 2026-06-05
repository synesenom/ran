---
date: 2026-06-05T00:00:00Z
category: "distribution"
problem: "Gamma-transform subclasses had no closed-form _q, forcing nondeterministic root-finding fallback"
status: complete
related_issue: "#689"
related_plan: "thoughts/plans/2026-06-04-2052-gamma-transform-quantile-closed-form.md"
tags: [quantile, gamma, closed-form, gammaLowerIncompleteInv, nondeterminism, inheritance-guard, precision]
---

# Solution: Gamma-Transform Quantile Closed-Form

**Date**: 2026-06-05T00:00:00Z
**Category**: distribution
**Related Issue**: #689

## Problem

Five Gamma-subclass distributions — `Chi`, `DoubleGamma`, `GeneralizedGamma`, `LogGamma`, and `MaxwellBoltzmann` — had no working quantile method. When `Gamma` gained a closed-form `_q`, these subclasses could not inherit it because each overrides `_cdf` with a monotone transform, making the parent's inverse mathematically wrong. The temporary fix was `this._q = undefined` in each subclass constructor, which shadows the prototype method and forces the generic `_qEstimateRoot` fallback. That fallback seeds its bracket from `Math.random()`, making quantile computation nondeterministic and capping round-trip precision at ~1e-13. Two indirect subclasses (`GeneralizedNormal`, `HalfGeneralizedNormal`) inherited from `GeneralizedGamma` and faced the same risk once `GeneralizedGamma` gained a real `_q`.

## Root Cause

The `this._q = undefined` guard was explicitly a temporary measure. It works by exploiting JavaScript's own-property/prototype distinction: an instance property `undefined` shadows the prototype method so `typeof this._q === 'function'` returns `false` in the base-class dispatch. This is correct behaviour — the parent's quantile is wrong for the transformed CDF — but it leaves the distribution without any quantile, falling back to a seeded root-finder. No closed-form existed per-subclass because no one had written it yet, not because the math was unavailable: every distribution's CDF is a known monotone transform of the Gamma CDF, so its quantile is the composition of `gammaLowerIncompleteInv` with the inverse of that transform.

## Fix

Each of the seven distributions received an explicit `_q(p)` method calling `gammaLowerIncompleteInv(this.p.alpha, p)` directly and applying the appropriate inverse transform:

| Distribution | CDF transform | `_q` formula |
|---|---|---|
| Chi | `F_X(x) = P(α, β·x²)` | `sqrt(P_inv(α,p) / β)` |
| MaxwellBoltzmann | same sqrt-of-Gamma pattern | `sqrt(P_inv(α,p) / β)` |
| DoubleGamma | symmetric fold around 0 | `±P_inv(α,\|2p−1\|) / β` |
| GeneralizedGamma | `F_X(x) = P(α, β·x^p)` | `(P_inv(α,p) / β)^(1/p_shape)` |
| LogGamma | `F_X(x) = P(α, β·log(x−μ+1))` | `exp(P_inv(α,p) / β) + μ − 1` |
| GeneralizedNormal | fold+shift around μ | `μ ± (P_inv(α,\|2p−1\|) / β)^(1/p_shape)` |
| HalfGeneralizedNormal | positive half of GGamma | `(P_inv(α,p) / β)^(1/p_shape)` |

`gammaLowerIncompleteInv` is always called directly, never via `super._q()` — following the established rule that any `super._q()` call shared across 6+ concrete subclasses goes megamorphic in V8's inline cache, causing ~56× deoptimization. After the fix, the `this._q = undefined` guards were removed, and three precision gate tolerances that had been loosened specifically to accommodate root-finder imprecision were tightened to `1e-14`.

Note: `LogGamma` achieves `qtol: 2e-14` rather than `1e-14` because the `exp()` transform amplifies Halley iteration error at the high tail; this is the analytical ceiling for this parameterisation.

## Prevention Strategy

- When adding a closed-form `_q` to any distribution base class, audit all subclasses for `this._q = undefined` guards — each one is now redundant debt that must be resolved.
- When writing a new distribution that is a monotone transform `X = g(Y)` of a parent variate, derive `_q` as `g(parent_quantile(p))` at the time of writing, not as an afterthought.
- Never use `super._q()` in any Gamma-family subclass — always call `gammaLowerIncompleteInv(this.p.alpha, p)` directly.
- The `Q_TOL` / `NOTES` dicts in `scripts/precision-refs-continuous.py` serve as a machine-readable audit trail. A `_N_ROOT` annotation signals a distribution still using the root-finder fallback — treat each one as an open debt.

## Related Solutions

- `solutions/correctness/2026-05-23-1930-gamma-subclass-q-inheritance-guard.md` — documents the prior guard-based fix this replaces
- `solutions/performance/2026-05-23-1810-super-q-v8-megamorphic-deoptimization.md` — documents the `super._q()` megamorphic deoptimization rule mandating direct `gammaLowerIncompleteInv` calls

## Key Insight

`this._q = undefined` in a Gamma subclass is a tracked correctness debt — whenever a Gamma-family distribution's CDF is a monotone transform `F_X(x) = F_Gamma(g(x))`, replace the guard with `_q(p) { return g_inv(gammaLowerIncompleteInv(this.p.alpha, p) / this.p.beta) }`, calling `gammaLowerIncompleteInv` directly (never `super._q()`) to stay below V8's megamorphic IC threshold.
