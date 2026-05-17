---
date: 2026-05-17T18:30:00Z
category: "testing"
problem: "scipy.stats.burr is Burr type III (not XII); GEV sign convention appears ambiguous; Dagum has no direct scipy equivalent"
status: complete
related_issue: "#128"
related_plan: "thoughts/plans/2026-05-17-1202-issue-128-refvals-extreme-heavy-tail.md"
tags: [refVals, reference-values, scipy, burr, burr12, dagum, gev, generalized-extreme-value, parameterization, support-boundary]
---

# Solution: scipy Burr Type Confusion, GEV Sign Convention, and Dagum Identity for refVals

**Date**: 2026-05-17T18:30:00Z
**Category**: testing
**Related Issue**: #128

## Problem

Nine distributions (Burr, Dagum, Frechet, GeneralizedExtremeValue, GeneralizedPareto, Gompertz, Kolmogorov, Levy, Lomax) had no `refVals` entries in `test/dist-cases-continuous.js`, leaving their `_pdf` and `_cdf` implementations without any cross-validated numeric regression guard. Three non-trivial mapping traps lurk in this family:

1. The obvious scipy function name for Burr XII (`scipy.stats.burr`) is actually Burr type III.
2. GEV has a conflicting sign convention in the literature; the issue body warned about negation but no negation was actually needed.
3. Dagum has no direct scipy equivalent.

## Root Cause

- **Burr naming**: scipy has two Burr functions. `scipy.stats.burr` implements Burr type III with PDF `c*d*x^{-c-1} / (1+x^{-c})^{d+1}`. `scipy.stats.burr12` implements Burr type XII with PDF `c*d*x^{c-1} / (1+x^c)^{d+1}`. ranjs implements Burr XII; using `scipy.stats.burr` produces systematically wrong values.
- **GEV sign**: The issue warned that scipy uses `-xi` vs. textbooks. In practice, `scipy.stats.genextreme.pdf(x, c)` uses exactly the formula `(1-c*x)^{1/c-1} * exp(-(1-c*x)^{1/c})` — identical to ranjs. No negation needed. The confusion arises from some textbooks parameterizing with `xi` where scipy's `c = -xi`.
- **Dagum**: scipy has no `dagum` function. R's `actuar` package has `ddagum`/`pdagum` but was unavailable. An algebraic identity provides an independent verification path.

## Fix

- **Burr**: Used `scipy.stats.burr12(c=c, d=k)` (not `burr`). Verified manually at x=1: pdf = 4·1/(1+1)³ = 0.5 ✓.
- **GEV (c=2)**: Used `scipy.stats.genextreme(c=2)` directly, same sign. All test points kept strictly below support boundary x < 1/c = 0.5; the boundary value yields pdf=Infinity which would fail the 1e-9 assertion.
- **Dagum (p,a,b)**: Cross-verified via identity: `Dagum(p,a,b).CDF(x) = 1 − Burr12(a,p).CDF(b/x)`. Values at round parameter combinations confirmed exact: at (p=2, a=2, b=2, x=2) → cdf = (1+(2/2)^{-2})^{-2} = (1+1)^{-2} = 0.25 ✓.
- **Gompertz**: `scipy.stats.gompertz(c=eta, scale=1/b)` maps to ranjs `gompertz(eta, b)`. The `scale=1/b` is non-obvious since ranjs uses `b` as a rate-like parameter.

## Prevention Strategy

When adding `refVals` for a new distribution:
1. **Look up the scipy function name explicitly** — do not assume the obvious name is correct (e.g., `burr` ≠ Burr XII).
2. **Verify with one manual point** before generating the full table — catches type mismatches immediately.
3. **For distributions without a scipy equivalent**, derive and document an algebraic identity that links it to a scipy-available distribution. State the identity in a comment near the `refVals` entry if non-obvious.
4. **For bounded-support distributions**, test points must stay strictly inside support; boundary evaluation returns Infinity/NaN and breaks the 1e-9 tolerance check.
5. Include `refVals` in the initial distribution PR, not as a follow-up — the gap accumulated here because these 9 distributions predate the refVals convention.

## Related Solutions

- `solutions/testing/2026-05-17-1825-scipy-parameterization-mismatches-truncatednormal-rice.md` — prior work on scipy parameterization mismatches for TruncatedNormal and Rice (#127)
- `solutions/testing/2026-05-17-1206-closed-form-refvals-without-scipy.md` — pattern for distributions with no scipy equivalent

## Key Insight

`scipy.stats.burr` is Burr type III — always use `scipy.stats.burr12` for Burr XII, and for any distribution with no scipy equivalent, derive and document an algebraic identity (such as `Dagum(p,a,b).CDF(x) = 1 − Burr12(a,p).CDF(b/x)`) to provide an auditable independent verification path.
