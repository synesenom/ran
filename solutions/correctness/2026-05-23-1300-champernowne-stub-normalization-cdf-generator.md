---
date: 2026-05-23T13:00:00Z
category: "correctness"
problem: "Champernowne distribution skeleton committed without export or tests — broken indefinitely and silently"
status: complete
related_issue: "#337"
related_plan: "thoughts/plans/2026-05-23-1210-champernowne-fix.md"
tags: [distribution, stub, normalization, cdf, generator, export, inverse-transform, champernowne]
---

# Solution: Champernowne Stub — Missing Normalization, Wrong CDF, Empty Generator

**Date**: 2026-05-23T13:00:00Z
**Category**: correctness
**Related Issue**: #337

## Problem

`src/dist/champernowne.js` existed in the codebase but every public method silently returned a wrong value:

- `sample()` always yielded `undefined` — `_generator()` had an empty body.
- `cdf(x)` always returned `1` regardless of `x` — `_cdf()` ignored its argument and returned the un-normalized constant `1`.
- `pdf(x)` was not a valid probability density — `_pdf(x)` used `norm = 1` with a `// TODO Add normalization factor` comment, so the PDF did not integrate to 1 and all likelihood/AIC/BIC values were wrong.
- `survival()`, `hazard()`, `cHazard()` were all incorrect as downstream consequences.

The class was also absent from `src/dist/index.js` (invisible to library users) and `dist/ranjs.d.ts` (TypeScript broken), with no test cases anywhere.

## Root Cause

The file was a development skeleton — structural scaffolding (constructor, parameter validation, support bounds, method stubs) committed before the mathematical content was worked out. Because it was never added to the module export index, no test suite could instantiate it, so the broken state persisted undetected. The `// TODO` comment explicitly marks that the author intended to return but never did.

## Fix

The normalization integral was solved via Weierstrass substitution (`t = tanh(u/2)`), reducing it to a standard `arctan` form:

```
∫_{-∞}^{∞} 1/(cosh(u) + lambda) du = 2·arccos(lambda) / sqrt(1 - lambda²)
```

This gives the normalization constant:

```
C = alpha · sqrt(1 - lambda²) / (2 · arccos(lambda))
```

The CDF follows from the same substitution:

```
F(x) = [arctan(k · tanh(alpha·(x-x0)/2)) + arctan(k)] / (2·arctan(k))
```

where `k = sqrt((1-lambda)/(1+lambda))`.

The CDF has a closed-form inverse (quantile function):

```
Q(p) = x0 + (2/alpha) · arctanh(tan((2p-1)·arctan(k)) / k)
```

This enables exact inverse-transform sampling in `_generator()` — no rejection loop needed. The constants `k`, `arctan(k)`, and `norm` are precomputed in `this.c` to avoid redundant computation per call.

The class was wired into `src/dist/index.js` and `dist/ranjs.d.ts`, and TDD-style test cases with externally-verified reference values (computed from the closed-form formulas and verified for internal consistency: PDF symmetric about x0, CDF satisfying `F(x0+d) + F(x0-d) = 1`, quantile values satisfying `Q(p) + Q(1-p) = 2·x0`) were added before the implementation was finalized.

## Prevention Strategy

**A distribution file is not "in the codebase" until it has three things**:
1. An export line in `src/dist/index.js`
2. A TypeScript declaration in `dist/ranjs.d.ts`
3. At least one `refVals` entry in `test/dist-cases-*.js`

Without all three, the distribution is a ghost: it compiles, imports as `undefined`, and any broken implementation goes undetected. The specific danger of `norm = 1` with a `// TODO` is that the PDF-normalizing constant propagates into every downstream method — `likelihood`, `aic`, `bic`, `sample`, `cdf`, `survival`, `hazard` — all silently wrong with no error thrown.

Practical rule: **do not commit a distribution file with a `// TODO` in the constructor constant block**. Either complete the math before committing or do not commit the file at all.

## Related Solutions

- [solutions/correctness/2026-05-18-1133-inverse-chi2-cdf-complementary-gamma.md](../correctness/2026-05-18-1133-inverse-chi2-cdf-complementary-gamma.md) — CDF returning 0 in lower tail (different root cause: complementary-form double-subtraction, but same symptom class of CDF returning a constant in part of its domain)
- [solutions/special-functions/2026-05-18-1212-noncentral-chi2-cdf-complementary-marcum-q.md](../special-functions/2026-05-18-1212-noncentral-chi2-cdf-complementary-marcum-q.md) — NoncentralChi2 CDF returning 0 in lower tail (same symptom class)

## Key Insight

A distribution skeleton committed without an index export is invisible to the test suite and can silently rot indefinitely — the export line and at least one `refVals` test case are the minimum bar for a distribution to be considered "present" rather than merely a file that exists.
