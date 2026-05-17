---
date: 2026-05-17T00:00:00Z
category: "distribution"
problem: "Delaporte chi² fails at seed 0 after gamma-boundary fix (#193)"
status: complete
related_issue: "#196"
tags: [delaporte, poisson-compound, chi2-test, gamma-sampler, prng-consumption, seed-sensitivity]
---

# Solution: Delaporte chi² seed 0 residual failure

**Date**: 2026-05-17
**Category**: distribution
**Related Issue**: #196

## Problem

After PR #197 fixed the gamma sampler boundary at α = 1 (issue #193), the
Delaporte distribution's failing seed shifted from `12345` (pre-fix) to `0`
(post-fix). Issue #196 was filed to investigate whether the residual failure
was a bug in `src/dist/_poisson.js` or statistical noise from N = 10 000 being
too tight.

## Investigation

### _poisson.js audit

Both code paths are algorithmically correct:

* **Small lambda (λ < 30) — Knuth's method.** Generates the smallest k such
  that the product of k i.i.d. Uniform(0, 1) draws falls below e^{-λ}.
  Returns k − 1. No boundary condition issues; the acceptance test is exact.

* **Large lambda (λ ≥ 30) — Ahrens-Dieter rejection sampler.** Uses a
  logistic envelope. The variable named `k` inside the large-λ branch is
  the log-normalizing constant `log c − λ − log b`; it does not conflict
  with the loop counter. No boundary or bias issue was found.

For Delaporte with default parameters (α = 1, β = 1, λ = 1), the compound
Poisson rate is `λ + Gamma(1, 1) = 1 + Exp(1)`, whose mean is 2. This stays
well below 30 in every sample, so only the small-lambda path is exercised.

### Why seed 0 appeared to fail

The issue was filed during the development of the gamma fix at an intermediate
code state. The old dispatch `if (a > 1)` sent α = 1 through the boost branch
`Gamma(2) * U^{1/1}`, which is analytically correct but consumes one extra
`r.next()` call per sample. Changing the dispatch to `a >= 1` (direct
Marsaglia-Tsang) altered the PRNG consumption pattern, shifting which random
numbers fed into the subsequent Poisson call and moving the marginal chi²
failure from seed 12345 to seed 0 in that intermediate state.

The final commit of PR #197 (the full `a >= 1` M-T path) cleared the seed 0
failure entirely. With the current codebase the chi² statistics at the three
canonical seeds are:

| Seed  | chi² | Critical (df=10/11, p=0.01) | Margin |
|-------|------|-----------------------------|--------|
| 0     | 20.67 | 23.21 | 11 %  |
| 42    | 9.35  | 24.73 | 62 %  |
| 12345 | 8.78  | 24.73 | 64 %  |

## Conclusion

No bug exists in `_poisson.js`. The residual seed 0 failure was an artefact
of an intermediate state during the PR #197 development; the final gamma fix
resolved it. No production-code change is required for issue #196.

## Key Insight

When a sampler fix alters PRNG consumption per draw, seed-indexed failures
can shift deterministically across seeds — the fix that cleared one seed can
appear to open a failure on another, giving the false impression of a new
independent bug. Verify against the *final* committed state, not an
intermediate commit, before filing a follow-up issue.
