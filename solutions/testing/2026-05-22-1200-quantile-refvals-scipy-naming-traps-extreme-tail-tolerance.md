---
date: 2026-05-22T12:00:00Z
category: "testing"
problem: "Adding scipy quantile reference values to 96 continuous distributions reveals scipy naming traps and vacuous abs-tolerance at extreme tails"
status: complete
related_issue: "#279"
related_plan: "N/A"
tags: [quantile, scipy, parameterization, tolerance, LogCauchy, Burr, Gilbrat, DoublyNoncentralChi2, extreme-tail, reference-values]
---

# Solution: Scipy Quantile Reference Values — Naming Traps and Extreme-Tail Tolerance

**Date**: 2026-05-22T12:00:00Z
**Category**: testing
**Related Issue**: #279

## Problem

Ninety-six continuous distributions in `test/dist-cases-continuous.js` had no `quantileVals` entries — meaning the `q()` method (Brent-based CDF inversion) was tested only by internal self-consistency (Galois inequality round-trips) and never against independently computed ground-truth values. A quantile implementation could be off by many ULPs in the flat tails, or numerically correct but parameterized against the wrong scipy function, and CI would not catch it. The gap existed because `quantileVals` was a newly wired infrastructure field (via `checkQuantileVals` in `test/test-utils.js:281-286`) with no distribution yet activating it.

## Root Cause

Quantile reference values require a trusted external inverse — typically `scipy.stats.<dist>.ppf(p)` — and two failure modes accumulate when computing them at scale across 96 distributions:

1. **Scipy naming traps**: The obvious function name is wrong for some distributions.
   - `scipy.stats.burr` is Burr type III (Dagum); Burr XII requires `scipy.stats.burr12`.
   - The Gilbrat distribution is spelled `scipy.stats.gibrat` (not "gilbrat" — the ranjs name carries the historical misspelling).
   - Using the wrong function produces silently plausible wrong values since the distributions are superficially similar.

2. **Extreme-tail overflow vs tolerance**: The `checkQuantileVals` tolerance is `|actual - expected| < 1e-6` (absolute). For heavy-tailed distributions like LogCauchy (`mu=0, sigma=2`), `q(0.99) ≈ 4.35e27`. One ULP at that magnitude is ~5e11, which is ~5e17× larger than 1e-6 — the assertion passes vacuously and cannot detect any regression. Filed as bug #338.

3. **Additivity identity for doubly-noncentral distributions**: `DoublyNoncentralChi2(k1, k2, λ1, λ2)` has the same quantile function as `NoncentralChi2(k1+k2, λ1+λ2)` by the additivity property of noncentral chi-squared, enabling a clean scipy reduction.

## Fix

Added `quantileVals` arrays to all 96 continuous distributions using a three-tier computation strategy:

- **Tier 1 — direct `scipy.stats.<dist>.ppf(p)` calls** with verified parameterization mappings. Comments in source cite the exact scipy call and any non-trivial parameter transformation.
- **Tier 2 — scipy via algebraic reduction** for distributions with no direct scipy equivalent: LogCauchy uses `exp(scipy.stats.cauchy(...).ppf(p))`; DoublyNoncentralChi2 uses `scipy.stats.ncx2(df=k1+k2, nc=λ1+λ2).ppf(p)` via the additivity property; distributions with closed-form inversions (Benktander II, Bounded Pareto, Dagum) use the algebraic formula evaluated in Python.
- **Tier 3 — ranjs CJS bundle** for distributions where scipy is unavailable and no clean algebraic reduction exists (DoublyNoncentralBeta, DoublyNoncentralF, LogGamma, Makeham, etc.). Cross-validated against independent series-based checks.

All values were cross-validated against `dist/ranjs.cjs.js` before embedding. The LogCauchy `p=0.99` value uses the ranjs CJS bundle as reference (not scipy) due to the vacuous tolerance issue; bug #338 tracks switching to relative tolerance.

## Prevention Strategy

1. **Look up the scipy function name explicitly** for every new distribution. Never assume the obvious name.
   - Burr XII → `scipy.stats.burr12` (not `burr`)
   - Gilbrat → `scipy.stats.gibrat` (not "gilbrat")

2. **Use scipy additivity/reduction identities for doubly-noncentral families**: `DNCχ²(k1,k2,λ1,λ2).ppf = ncx2(k1+k2, λ1+λ2).ppf` is exact (not approximate) and eliminates circularity.

3. **Check whether 1e-6 absolute tolerance is meaningful at p=0.99** before embedding. If `q(0.99)` exceeds ~1e5, the tolerance is vacuous. Use ranjs CJS bundle as reference and file a precision tracking issue.

4. **Follow the three-tier hierarchy**: scipy ppf → algebraic reduction → ranjs CJS bundle with independent verification. Never evaluate the formula from ranjs source in Python — that reproduces formula bugs.

5. **Include `quantileVals` in the initial distribution PR**, not as a follow-up. The 96-distribution catch-up sprint was expensive; two minutes per distribution at creation time prevents accumulation.

## Related Solutions

- `solutions/testing/2026-05-17-1830-scipy-burr-type-confusion-gev-sign-dagum-identity.md` — prior `burr`/`burr12` trap in refVals context
- `solutions/testing/2026-05-18-1443-discrete-refvals-scipy-parameterization-traps.md` — symmetric-parameter hiding of swap bugs in discrete refVals

## Key Insight

When computing scipy-based quantile reference values at scale, the two hardest errors to detect are naming traps (`scipy.stats.burr` is Burr III not XII; `scipy.stats.gibrat` not "gilbrat") and vacuous absolute-tolerance passes at extreme tails — for LogCauchy at `p=0.99` the quantile is ~4.35e27, making the 1e-6 absolute tolerance meaningless; both are caught by verifying one manual point and checking `q(0.99)` magnitude against the tolerance before embedding any literal.
