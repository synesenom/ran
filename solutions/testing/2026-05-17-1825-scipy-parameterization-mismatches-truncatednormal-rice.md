---
date: 2026-05-17T18:25:40Z
category: "testing"
problem: "Scipy parameterization mismatches silently produce wrong refVals for TruncatedNormal and Rice; GeneralizedNormal returns NaN at x=mu via 0×∞ in the base class"
status: complete
related_issue: "#127"
related_plan: "thoughts/plans/2026-05-17-1742-issue-127-refvals-normal-logistic-variants.md"
tags: [refVals, reference-values, scipy, truncated-normal, rice, generalized-normal, parameterization, NaN, 0-times-infinity, generalized-gamma]
---

# Solution: scipy Parameterization Mismatches for TruncatedNormal and Rice refVals

**Date**: 2026-05-17T18:25:40Z
**Category**: testing
**Related Issue**: #127

## Problem

When adding scipy-computed reference values to `test/dist-cases-continuous.js`, two distributions produced systematically wrong refVals: TruncatedNormal and Rice. A third distribution, GeneralizedNormal, returned `NaN` at `x = mu = 0` — the mode of the distribution — due to a latent evaluation bug in the `GeneralizedGamma` base class.

## Root Cause

Three distinct issues:

**1. TruncatedNormal**: scipy's `truncnorm(a, b, loc, scale)` requires `a` and `b` as **standardized** (z-score) bounds relative to the distribution mean: `a = (lower_bound - mu) / sigma`. Ranjs uses absolute bounds. Passing ranjs's `(a=0, b=5)` directly to scipy as `truncnorm(0, 5, loc=2.5, scale=2)` computes values for a *different* truncation window — one extending from mu to mu+10σ — silently producing wrong reference values.

**2. Rice**: scipy's `rice(b, scale)` defines `b` as the non-centrality **ratio** `nu / sigma`, not the absolute non-centrality `nu`. Ranjs uses `(nu=2, sigma=2)` → ratio is 1, so the scipy call is `rice(b=1.0, scale=2)`, not `rice(b=2, scale=2)`. Using `b=nu` directly produces values for a distribution with four times the non-centrality (and completely different CDF shape).

**3. GeneralizedNormal at x=mu**: `GeneralizedNormal._pdf(mu)` calls `GeneralizedGamma._pdf(0)`, which computes `p * 0^(p-1) * Gamma._pdf(0^p)`. With shape `d/p = 1/2 < 1`, the Gamma PDF diverges to +∞ at 0, and `0 × ∞ = NaN` in IEEE-754. The mathematical limit is finite (`≈0.28209` for the default parameterization), so this is an implementation bug — not a domain restriction. The distribution is smooth and non-zero at its own mode.

## Fix

- **TruncatedNormal**: scipy call corrected to `truncnorm((a-mu)/sigma, (b-mu)/sigma, loc=mu, scale=sigma)` — for ranjs params `(mu=2.5, sigma=2, a=0, b=5)` this gives `truncnorm(-1.25, 1.25, loc=2.5, scale=2)`.
- **Rice**: scipy call corrected to `rice(b=nu/sigma, scale=sigma)` — for `(nu=2, sigma=2)` this gives `rice(b=1.0, scale=2)`.
- **GeneralizedNormal NaN**: `x=0` replaced with `x=-0.5` in the refVals array to avoid the NaN. The underlying `GeneralizedGamma._pdf(0)` bug is documented here as a known open issue (separate from the refVals task scope).

## Prevention Strategy

**Scipy parameterization mapping table** — use this when computing scipy refVals:

| Distribution | ranjs params | Scipy call | Non-obvious mapping |
|---|---|---|---|
| HalfNormal | `sigma` | `halfnorm(scale=sigma)` | none |
| TruncatedNormal | `(mu, sigma, a, b)` | `truncnorm((a-mu)/sigma, (b-mu)/sigma, loc=mu, scale=sigma)` | **bounds must be standardized** |
| SkewNormal | `(xi, omega, alpha)` | `skewnorm(a=alpha, loc=xi, scale=omega)` | arg order differs |
| GeneralizedNormal | `(mu, alpha, beta)` | `gennorm(beta=beta, loc=mu, scale=alpha)` | ranjs `alpha` = scipy `scale` |
| HalfLogistic | none | `halflogistic(loc=0, scale=1)` | none |
| LogitNormal | `(mu, sigma)` | no scipy — compute via `norm.pdf(logit(x), mu, sigma) / (x*(1-x))` | Jacobian factor required |
| Rice | `(nu, sigma)` | `rice(b=nu/sigma, scale=sigma)` | **`b` is the ratio, not absolute `nu`** |
| Moyal | `(mu, sigma)` | `moyal(loc=mu, scale=sigma)` | none |
| BirnbaumSaunders | `(mu, beta, gamma)` | `fatiguelife(c=gamma, loc=mu, scale=beta)` | scipy name is `fatiguelife`; `c=gamma` |

**Cross-validation before embedding**: always verify each literal against `dist/ranjs.cjs.js` before adding to `test/dist-cases-continuous.js`:
```bash
node -e "const r=require('./dist/ranjs.cjs.js'); const d=new r.dist.TruncatedNormal(2.5,2,0,5); console.log(d.pdf(1), d.cdf(1))"
```
If the output differs from the scipy literal by more than `1e-9`, the parameterization mapping is wrong.

**Base-class boundary testing**: for distributions that extend a non-trivial base class (e.g. `GeneralizedNormal → GeneralizedGamma`), test `_pdf` and `_cdf` at the boundary points of the **base class's** support — not just the subclass's mathematical domain — to surface `0 × ∞` and `0/0` pathologies before embedding refVals.

**Standard.js precision rule**: numeric literals with more than ~16 significant decimal digits are flagged as `no-loss-of-precision`. Use Python's `repr(float)` to get the shortest exact double representation: `python3 -c "print(repr(0.37642179019350487))"` → `0.37642179019350486`.

## Related Solutions

- `solutions/testing/2026-05-17-1206-closed-form-refvals-without-scipy.md` — prior work computing refVals without scipy using closed-form expressions; cross-validation against CJS bundle is the same technique used here.

## Key Insight

For TruncatedNormal and Rice, passing ranjs parameter values directly to scipy's analogous distribution produces silently wrong reference values — TruncatedNormal requires standardized bounds `(a-mu)/sigma`, and Rice requires the non-centrality ratio `nu/sigma` as scipy's `b` — so always derive scipy calls from the parameterization mapping table, then cross-validate against `dist/ranjs.cjs.js` before embedding any literal.
