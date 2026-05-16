---
date: 2026-05-16T18:51:00Z
category: "distribution"
problem: "Gamma sampler dispatched α = 1 to the boost branch, inflating finite-sample KS variance"
status: complete
related_issue: "#193"
related_plan: "thoughts/plans/2026-05-16-1840-issue-193-gamma-sampler-fix.md"
tags: [gamma-sampler, marsaglia-tsang, boundary-condition, prng-draws, ks-test, finite-sample-variance, multi-seed-testing]
---

# Solution: Gamma sampler boundary at shape α = 1

**Date**: 2026-05-16T18:51:00Z
**Category**: distribution
**Related Issue**: #193

## Problem

After PR #192 strengthened the distribution sampling test from 1 seed to 3
seeds (`[0, 42, 12345]` at N=10000), 24 KS and chi-squared assertions failed
across 11 distributions. Eighteen of those failures came from distributions in
the gamma family (Gamma, Chi, Chi2, Erlang, InverseGamma, LogGamma, Nakagami,
GeneralizedGamma) — all using default parameters that resolve to shape `α = 1`.
Seed 0 (the only seed previously exercised) happened to pass; seed 42 happened
to land just over the p=0.01 critical value.

## Root Cause

`src/dist/_gamma.js` dispatched shape `α = 1` to the Marsaglia-Tsang **boost**
branch (`gamma(r, a+1, b) * Math.pow(r.next(), 1/a)`) via the condition
`if (a > 1)`, rather than running Marsaglia-Tsang directly. The boost identity
`X · U^{1/α} ~ Gamma(α)` for `X ~ Gamma(α+1)` is *analytically exact*, but
consuming one additional `r.next()` draw per sample amplifies finite-sample
variance.

At N=10000 with seed 42, this pushed the KS statistic for `Gamma(1, 1)` from
0.012 (direct M-T) to 0.017 (boost path), crossing the p=0.01 critical value
of 0.01628 = `1.628 / √10000`. At N=100000 both paths converged to KS ≈ 0.002,
confirming the algorithm is **asymptotically unbiased** — the bug was in the
finite-sample convergence rate, not the limiting distribution.

The boundary `a > 1` was off by one. Marsaglia-Tsang's precondition is
`d = a − 1/3 > 0`, which is satisfied at `α = 1` (`d = 2/3`). Devroye §IX.3.4
and the original Marsaglia & Tsang (2000) paper both prescribe direct M-T for
`α ≥ 1` and the boost only for `α < 1`.

## Fix

Changed the dispatch condition from `a > 1` to `a >= 1` in `src/dist/_gamma.js`
(one character of production change, plus a WHY comment citing issue #193 and
the failure mode). This cleared 18 of 24 failing assertions. The remaining 6
(Categorical, Hypergeometric, SkewNormal, Zipf, Delaporte) have independent
root causes in the alias-table sampler, Box-Muller, and the Poisson compound,
and were filed as follow-up issues #194, #195, #196.

## Prevention Strategy

1. **Match the boundary condition to the algorithm's stated precondition**,
   not to an intuitive reading of the parameter value. When implementing a
   sampling routine with two mathematically equivalent branches (one for the
   general case, one as a "boost" or "stretch" for boundary shapes), pin the
   branch dispatch to the precondition cited in the source reference. For
   Marsaglia-Tsang that's `d = a − 1/3 > 0`, i.e. `a ≥ 1` for the direct path
   when paired with a boost for `a < 1`.

2. **Prefer the path that consumes the fewest PRNG draws** when both are
   analytically equivalent. Each extra `r.next()` is finite-sample variance
   you can't reason away from the limiting distribution.

3. **Test samplers with multiple fixed seeds**. A single seed can hide a
   variance inflation that a tighter algorithm would clear; multiple fixed
   seeds at the same N expose latent bias deterministically without changing
   the test infrastructure. The 1-seed → 3-seed change in PR #192 was the
   detection mechanism here.

4. **At a boundary parameter that lands on common defaults, prefer the more
   numerically stable / efficient path** even when the alternatives are
   analytically equivalent — default parameters are exercised orders of
   magnitude more often than random parameters in practice.

## Related Solutions

- `solutions/distribution/2026-05-15-1730-negative-binomial-p-strict-bounds.md`
  — also a parameter-boundary correction, but in *validation* rather than
  algorithm dispatch.
- `solutions/distribution/2026-05-15-1921-fisher-z-pdf-log-space-overflow.md`
  — also a sampler/PDF path swap motivated by finite-precision behaviour
  rather than analytical equivalence.

## Key Insight

Two sampling paths that are analytically equivalent in distribution can
differ in finite-sample KS statistics when one path consumes an extra PRNG
draw per sample — pin branch dispatch to the algorithm's stated precondition
(here `d > 0`, i.e. `α ≥ 1`), prefer the path with fewer `r.next()` calls,
and use multi-seed statistical tests to make boundary-dispatch errors
detectable rather than latent.
