---
date: 2026-05-17T12:06:50Z
category: "testing"
problem: "12 core continuous distributions had no third-party reference values despite refVals infrastructure being wired"
status: complete
related_issue: "#125"
related_plan: "thoughts/plans/2026-05-17-1152-issue-125-core-continuous-refvals.md"
tags: [refVals, reference-values, closed-form, scipy, distribution-testing, checkRefVals, pdf, cdf]
---

# Solution: Closed-Form Reference Values Without Scipy

**Date**: 2026-05-17T12:06:50Z
**Category**: testing
**Related Issue**: #125

## Problem

Twelve core continuous distributions (Beta, Cauchy, Exponential, Gamma, Gumbel, Laplace, LogNormal, Logistic, Normal, Pareto, Uniform, Weibull) had no `refVals` entries in `test/dist-cases-continuous.js`. The `checkRefVals` infrastructure in `test/test-utils.js:198-211` and the runner hook in `test/dist.js:131-135` were fully wired and waiting, but no distribution activated them. PDF and CDF implementations were verified only by internal consistency (KS test, quantile inversion) — not against independently computed ground-truth values. Parameterization bugs (e.g., rate vs. scale confusion) could go undetected.

## Root Cause

The `refVals` field is optional in the test fixture schema. Absent entries don't cause test failures — the gap is silent. Generating reference values normally depends on scipy or a similar trusted external library, which was unavailable in the environment. No one had committed to the slower alternative of deriving values manually from closed-form formulas.

## Fix

For each of the 12 distributions, four interior x-values were selected. Expected PDF and CDF values were computed from exact closed-form expressions:

- **Beta(2,2)**: `pdf = 6x(1−x)`, `cdf = 3x²−2x³` (polynomial closed form)
- **Gamma(2,2) rate**: `pdf = 4x·e^{−2x}`, `cdf = 1 − (1+2x)·e^{−2x}` (integer-alpha closed form)
- **Exponential(λ=2)**: `pdf = 2e^{−2x}`, `cdf = 1 − e^{−2x}`
- **Normal/LogNormal**: erf-based via Python's `math.erf`
- **Cauchy/Laplace/Logistic/Gumbel/Weibull/Pareto/Uniform**: direct closed-form expressions

All 48 `{ x, pdf, cdf }` tuples were then cross-validated against `dist/ranjs.cjs.js` using Node.js one-liners, confirming agreement within `PRECISION = 1e-9` (defined in `test/test-utils.js:5`). The verified literals were embedded as `refVals` fields at the top level of each distribution entry in `test/dist-cases-continuous.js`, which automatically activates `checkRefVals` for each distribution.

## Prevention Strategy

When scipy is unavailable, prefer distributions with tractable closed-form CDFs for manual derivation:

1. **Prioritise polynomial CDFs** (Beta, Uniform, triangular families) — derivation is algebraic, zero floating-point error
2. **Integer-α Gamma** has a closed-form CDF: `P(n, x) = 1 − e^{−x} Σ_{k=0}^{n-1} x^k/k!`
3. **Exponential family** (Exponential, Weibull, Pareto, Gumbel, Logistic, Laplace, Cauchy) all have elementary closed forms
4. **Normal/LogNormal** require `erf` — available in Python's `math` module and therefore computable without scipy
5. **Always cross-validate** computed literals against `dist/ranjs.cjs.js` before embedding — a Node.js one-liner takes under a minute and catches formula mistakes immediately
6. **Use `cases[0].params()` as the canonical parameter set** — the test runner at `test/dist.js:133` always instantiates from `cases[0]`
7. **Choose x strictly interior to the support** — boundary values introduce edge cases unrelated to the distribution formula

## Related Solutions

- `solutions/testing/2026-05-16-0653-galois-inequality-ulp-guard.md` — ULP-magnitude guards for quantile Galois inequality; complementary precision strategy for distribution testing
- `solutions/testing/2026-05-16-1915-alias-table-chi2-df-correction.md` — chi-squared false positives in discrete sampling tests; different test assertion layer

## Key Insight

When scipy is unavailable, closed-form reference values for common distributions (especially polynomial CDFs like Beta(2,2) and exponential-family CDFs like Gamma(2,2)) can be computed by hand and verified against the built CJS bundle in minutes — the bottleneck is knowing the closed form, not the tooling.
