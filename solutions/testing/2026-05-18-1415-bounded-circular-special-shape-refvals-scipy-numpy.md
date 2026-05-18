---
date: 2026-05-18T14:15:00Z
category: "testing"
problem: "10 bounded/circular/special-shape distributions lacked refVals; 4 had non-obvious scipy mappings and 1 (VonMises) had a CDF series that exceeds 1e-10 tolerance vs scipy at intermediate x values"
status: complete
related_issue: "#132"
related_plan: "thoughts/plans/2026-05-18-1210-issue-132-refvals-bounded-circular-special-shape.md"
tags: [refVals, reference-values, scipy, numpy, arcsine, beta-prime, bradford, beta-rectangular, kumaraswamy, u-quadratic, raised-cosine, wigner, von-mises, pert, reparameterization, series-truncation]
---

# Solution: refVals for 10 Bounded, Circular, and Special-Shape Distributions (Issue #132)

**Date**: 2026-05-18T14:15:00Z
**Category**: testing
**Related Issue**: #132

## Problem

Ten distributions in `test/dist-cases-continuous.js` lacked `refVals` arrays: BetaPrime, Arcsine,
Bradford, BetaRectangular, Kumaraswamy, UQuadratic, RaisedCosine, Wigner, VonMises, and PERT.
Without third-party reference values, parameterization bugs and formula transcription errors in these
distributions are undetectable by the existing KS/chi-squared sampling tests alone.

Three structural complications arose:

1. **scipy.stats.cosine is not ranjs RaisedCosine.** scipy uses `(1+cos(x))/(2π)` on `[-π, π]`;
   ranjs uses `(1+cos(π(x-μ)/s))/(2s)` on `[μ-s, μ+s]`. A mapping exists (`scale=s/π`) but the
   formula is trivially unique, making numpy direct evaluation the cleaner path.

2. **VonMises CDF series truncation exceeds `refValTol = 1e-10`.** The ranjs `_cdf` uses
   `recursiveSum` over Bessel terms. At intermediate x values (x ≈ ±1.5, kappa=2), accumulated
   truncation error reaches ~3.7e-10 vs scipy — above the fixed 1e-10 tolerance. Only x = ±3
   (diff ~5.2e-11) and x = 0 (exact 0.5 by symmetry) are safe to embed.

3. **Arcsine and PERT require reparameterization.** scipy arcsine is on [0,1]; ranjs uses general
   `[a,b]`. PERT `(a,b,c) = (5,15,25)` yields alpha=beta=3 → `scipy.stats.beta(3,3)` scaled
   to `[a,c]`.

## Root Cause

The distributions split into four groups by their scipy coverage status:

**Group 1 — direct scipy mappings (2 distributions)**:
- `BetaPrime(alpha=2, beta=2)` → `scipy.stats.betaprime(2, 2)` (direct, `a=alpha`, `b=beta`)
- `Bradford(c=2)` → `scipy.stats.bradford(2)` (direct)

**Group 2 — scipy with reparameterization (3 distributions)**:
- `Arcsine(5, 25)`: `y = (x-a)/(b-a)`, `pdf(x) = arcsine.pdf(y)/(b-a)`, `cdf(x) = arcsine.cdf(y)`
- `BetaRectangular(2, 2, 0.5, 5, 25)`: `theta * beta(2,2).pdf(y)/(b-a) + (1-theta)/(b-a)` for PDF;
  `theta * beta(2,2).cdf(y) + (1-theta)*y` for CDF; where `y = (x-a)/(b-a)`
- `PERT(5, 15, 25)`: alpha=beta=3, `beta(3,3).pdf((x-a)/(c-a))/(c-a)` for PDF;
  `beta(3,3).cdf((x-a)/(c-a))` for CDF

**Group 3 — numpy closed-form from trivially unique formula (4 distributions)**:
Kumaraswamy, UQuadratic, RaisedCosine, and Wigner have no scipy equivalent and formulas with no
parameterization degrees of freedom. Numpy evaluation of the published formula is genuinely
independent (different language, different arithmetic path, same math).

**Group 4 — scipy with precision constraint (1 distribution)**:
VonMises PDF matches scipy to machine precision. CDF diverges by up to 3.7e-10 at mid-range x
due to `recursiveSum` Bessel series truncation — a pre-existing precision defect (filed as #255).

## Fix

Added `refVals` arrays to all 10 distributions. Scipy parameterization table:

| Distribution | ranjs params | Computation | Non-obvious mapping |
|---|---|---|---|
| BetaPrime | `(alpha=2, beta=2)` | `betaprime(2, 2)` | direct |
| Arcsine | `(a=5, b=25)` | `arcsine.{pdf,cdf}` with y-transform | `y=(x-a)/(b-a)`; PDF *= 1/(b-a) |
| Bradford | `(c=2)` | `bradford(2)` | direct |
| BetaRectangular | `(2,2,0.5,5,25)` | `theta*beta(2,2).pdf(y)/(b-a)+(1-theta)/(b-a)` | explicit mixture formula |
| Kumaraswamy | `(a=2, b=2)` | numpy: `a*b*x^(a-1)*(1-x^a)^(b-1)` | trivially unique |
| UQuadratic | `(a=5, b=25)` | numpy: `alpha*(x-beta)^2` | `alpha=12/(b-a)^3`, `beta=(a+b)/2` |
| RaisedCosine | `(mu=0, s=2)` | numpy formula; scipy.cosine uses `1/(2π)` not `1/(2s)` | trivially unique after confirming scipy mismatch |
| Wigner | `(R=2)` | numpy: `2*sqrt(R^2-x^2)/(π*R^2)` | trivially unique |
| VonMises | `(kappa=2)` | `vonmises(2)`, x ∈ {-3, 0, 3} only | series precision limits safe x values |
| PERT | `(5, 15, 25)` | `beta(3, 3)` scaled to [5, 25] | alpha=beta=3 from PERT formula |

VonMises refVals limited to 3 points. Bug #255 tracks the series-precision fix; once resolved,
interior x values can be added.

All literals cross-validated against `dist/ranjs.cjs.js` before embedding (max diff < 5.2e-11
for all embedded points). 10 new tests pass; suite total: 2703 passing.

## Prevention Strategy

When adding refVals to a bounded or reparameterized distribution:

1. **Check scipy convention before assuming a direct match.** `scipy.stats.cosine` is NOT the
   ranjs RaisedCosine — the scale factor is `1/(2π)` vs `1/(2s)`. Always verify the formula
   matches before using a function by name.

2. **For location-scale reparameterizations (Arcsine, PERT), derive the Jacobian explicitly.**
   For a distribution on `[a,b]` mapped from scipy's `[0,1]`: `pdf(x) = scipy_pdf(y)/(b-a)` and
   `cdf(x) = scipy_cdf(y)` where `y = (x-a)/(b-a)`.

3. **For series-based CDFs (VonMises), probe the error profile before embedding.** Compute
   `|ranjs_cdf(x) - scipy_cdf(x)|` at a grid of x values. Only embed x values where diff < 1e-10.
   Document the omission with the related bug issue number so it's traceable.

4. **For distributions without scipy equivalents, use numpy from the published formula only if
   the formula is unique** — i.e., no parameterization degrees of freedom that the formula doesn't
   specify. Kumaraswamy, UQuadratic, Wigner, and RaisedCosine all qualify; Muth (previous batch)
   does not because its CDF has a non-obvious form.

5. **Always cross-validate every literal against `dist/ranjs.cjs.js`.** If `|ranjs - ref| > 1e-9`,
   the parameterization mapping is wrong; if `1e-10 < diff < 1e-9`, it may be a series precision
   issue that limits which x values are safe.

## Related Solutions

- `solutions/testing/2026-05-18-0000-weibull-survival-refvals-scipy-fisk-numpy.md` — prior batch with algebraic change-of-variables for scipy-unavailable distributions
- `solutions/testing/2026-05-17-1830-scipy-burr-type-confusion-gev-sign-dagum-identity.md` — scipy naming pitfalls (Burr III/XII, GEV sign)
- `solutions/testing/2026-05-17-1825-scipy-parameterization-mismatches-truncatednormal-rice.md` — systematic parameterization mapping errors

## Key Insight

When a CDF series implementation (VonMises `recursiveSum`) has ~3.7e-10 truncation error vs scipy
at intermediate x values, the correct response is to restrict `refVals` to the x values where the
series has actually converged, file a precision bug for the intermediate regime, and document both
decisions inline — not to relax the tolerance or skip the distribution entirely.
