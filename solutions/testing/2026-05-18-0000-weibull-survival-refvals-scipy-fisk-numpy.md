---
date: 2026-05-18T00:00:00Z
category: "testing"
problem: "9 Weibull/survival-model distributions lacked refVals; 5 have no direct scipy.stats equivalent and require an independent computation strategy"
status: complete
related_issue: "#129"
related_plan: "thoughts/plans/2026-05-17-2015-issue-129-refvals-weibull-survival.md"
tags: [refVals, reference-values, scipy, weibull, survival-models, log-logistic, muth, makeham, gamma-gompertz, fisk, algebraic-equivalence]
---

# Solution: refVals for 9 Weibull and Survival-Model Distributions (Issue #129)

**Date**: 2026-05-18T00:00:00Z
**Category**: testing
**Related Issue**: #129

## Problem

Nine distributions in `test/dist-cases-continuous.js` lacked `refVals` arrays:
ExponentiatedWeibull, InvertedWeibull, DoubleWeibull, LogLogistic, ShiftedLogLogistic,
LogisticExponential, Muth, Makeham, GammaGompertz.

Of these, only 4 have direct scipy.stats equivalents. The remaining 5 needed an independent
computation method that does NOT reproduce ranjs source code — using mpmath with manually
transcribed formulas would replicate any formula bugs and is not truly independent.

## Root Cause

The distributions split into three groups:

**Group 1 — direct scipy.stats mappings (4 distributions)**: These have unambiguous scipy
functions with clear parameterization mappings (see table below).

**Group 2 — scipy.stats.fisk via algebraic change-of-variables (2 distributions)**:
ShiftedLogLogistic and LogisticExponential do not have dedicated scipy functions, but both are
related to the Log-Logistic distribution (scipy.stats.fisk) by a change of variable:

- `ShiftedLogLogistic(mu=0, sigma=2, xi=2)`: let u = 1 + x (shift so lower bound → 0).
  Then `F(x) = fisk(c=0.5, scale=1).cdf(u)` and `f(x) = fisk(c=0.5, scale=1).pdf(u)`.
  Derivation: SLL CDF = (1 + (1+ξz)^{-1/ξ})^{-1} with z=(x-μ)/σ; substituting u=1+x (so
  1+ξz = 1+2(x-0)/2 = 1+x = u) gives (1+u^{-0.5})^{-1} = fisk(c=0.5).cdf(u).

- `LogisticExponential(lambda=2, kappa=2)`: let u = exp(λx)-1. Then
  `F(x) = fisk(c=κ, scale=1).cdf(u)` and `f(x) = fisk(c=κ, scale=1).pdf(u) · λ·exp(λx)`.
  Derivation: LE CDF = 1/(1+(exp(λx)-1)^{-κ}) = fisk(c=κ).cdf at u=exp(λx)-1.

Both equivalences were verified numerically against all embedded literals (max relative error
< 3e-15, well within machine epsilon).

**Group 3 — numpy closed-form from published literature (3 distributions)**:
Muth, Makeham, and GammaGompertz all have unique closed-form CDFs from their defining papers.
The CDF formula is unique — any correct implementation must evaluate the same expression. Using
numpy to evaluate the published formula is independent of ranjs source (different language,
different arithmetic path, same mathematical result). Verified against all embedded literals
(max relative error < 4e-15).

## Fix

Added `refVals` arrays to all 9 distributions in `test/dist-cases-continuous.js`. 2660 tests pass.

## scipy/numpy Parameterization Table

| Distribution | ranjs params | Computation | Non-obvious mapping |
|---|---|---|---|
| ExponentiatedWeibull | `(lambda=2, k=2, alpha=2)` | `exponweib(a=2, c=2, loc=0, scale=2)` | scipy `a` = ranjs `alpha`; `c` = ranjs `k`; `scale` = ranjs `lambda` |
| InvertedWeibull | `(c=2)` | `invweibull(c=2, loc=0, scale=1)` | direct |
| DoubleWeibull | `(lambda=2, k=2)` | `dweibull(c=2, loc=0, scale=2)` | scipy `c` = ranjs `k`; `scale` = ranjs `lambda` |
| LogLogistic | `(alpha=2, beta=2)` | `fisk(c=2, loc=0, scale=2)` | scipy `c` = ranjs `beta`; `scale` = ranjs `alpha` |
| ShiftedLogLogistic | `(mu=0, sigma=2, xi=2)` | `fisk(c=0.5, scale=1).{pdf,cdf}(1+x)` | `c = 1/xi`; shift `u = 1 + (x-mu)/(sigma/xi)` |
| LogisticExponential | `(lambda=2, kappa=2)` | `fisk(c=2, scale=1).cdf(exp(2x)-1)`, PDF needs chain rule | `c = kappa`; `u = exp(lambda*x)-1`; PDF *= `lambda*exp(lambda*x)` |
| Muth | `(alpha=0.5)` | `1 - exp(alpha*x - (exp(alpha*x)-1)/alpha)` | numpy closed-form from Jodra et al. 2015 |
| Makeham | `(alpha=2, beta=2, lambda=2)` | `1 - exp(-lambda*x - alpha/beta*(exp(beta*x)-1))` | numpy closed-form from Gompertz-Makeham law |
| GammaGompertz | `(b=2, s=2, beta=2)` | `1 - (1 + (exp(b*x)-1)/beta)^(-s)` | numpy closed-form from Wikipedia |

## Known Pre-existing Issues (Out of Scope)

- `InvertedWeibull._pdf(0)` returns NaN due to 0×∞ form (`0^(-c-1) * exp(-0^(-c))`). The support
  is marked closed at 0, but the mathematical limit is 0. No refVal test point at x=0 was added
  to avoid a false failure; this is a separate bug.
- `ShiftedLogLogistic._pdf(mu - sigma/xi)` (lower boundary, closed) returns NaN similarly. The PDF
  diverges at the lower boundary for all ξ > 0, so the closed boundary is mathematically ill-posed
  for the PDF evaluation.

## Prevention Strategy

When a distribution has no direct scipy equivalent, look for it as a special case of a known
distribution via change-of-variables before falling back to formula-level computation:

1. Identify the distribution family (e.g., generalized log-logistic).
2. Check if scipy has a parameterized version (fisk, genlogistic, etc.).
3. Derive the change-of-variables analytically.
4. Verify numerically at 3+ test points.

For distributions where this is not possible, use numpy/scipy to evaluate the published closed-form
CDF (not the ranjs source) — if the CDF formula is unique (no degrees of freedom in the algebraic
form), numpy evaluation IS independent validation.

## Related Solutions

- `solutions/testing/2026-05-17-1206-closed-form-refvals-without-scipy.md` — prior work on refVals
- `solutions/testing/2026-05-17-1825-scipy-parameterization-mismatches-truncatednormal-rice.md` — parameterization pitfalls
- `solutions/testing/2026-05-17-1830-scipy-burr-type-confusion-gev-sign-dagum-identity.md` — scipy naming pitfalls

## Key Insight

For distributions without direct scipy support, search for algebraic equivalences to known
scipy distributions before transcribing formulas. The ShiftedLogLogistic and LogisticExponential
families are both log-logistic variants expressible via `scipy.stats.fisk` after a straightforward
change of variable — providing truly independent verification rather than formula reproduction.
