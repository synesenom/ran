---
date: 2026-07-28T16:01:00Z
category: "testing"
problem: "OrnsteinUhlenbeck.fit() and CoxIngersollRoss.fit() recovery tests used flat percentage tolerances instead of tolerances derived from the estimator's own sampling variance"
status: complete
related_issue: "#1133"
related_plan: "thoughts/plans/2026-07-28-1530-process-fit.md"
tags: [testing, statistical-tests, tolerance-derivation, ols, delta-method, process-fit]
---

# Solution: Flat-percentage recovery-test tolerances can mask systematic estimator bugs

**Date**: 2026-07-28
**Category**: testing
**Related Issue**: #1133

## Problem

While implementing `.fit()` parameter-recovery tests for `OrnsteinUhlenbeck` and
`CoxIngersollRoss` (both estimators built on OLS regression), the initial tests asserted recovered
parameters against a flat percentage tolerance (`0.15 * theta`, `0.2 * kappa`, etc.) rather than a
tolerance derived from the estimator's actual sampling distribution. This was inconsistent with the
sibling `BrownianMotion`/`GeometricBrownianMotion` `.fit()` tests added in the same change, which
compute `tolMu`/`tolSigma` analytically from the known variance of a sample mean/variance (CLT),
matching the codebase's own `assertSampleMoments` helper convention in `test/process.js`. A `/review`
pass (the `review-tests` agent) caught the inconsistency and flagged that the flat bands were loose
enough to pass even with a systematic ~10% bug in the closed-form back-substitution formulas
(e.g. `theta_hat = -ln(b_hat)/dt`, `sigma_hat = sqrt(s2 * 2*theta_hat / (1 - b_hat^2))`).

## Root Cause

A flat percentage tolerance is typically chosen by feel — "this seems like it should be close
enough at this sample size" — rather than derived from the estimator's known asymptotic variance.
Because OLS-based estimators recovering nonlinear back-substituted parameters (e.g. `theta` from
the AR(1) slope `b` via `theta = -ln(b)/dt`) have a sampling variance that depends on sample size,
the true parameter values, and the specific nonlinear transform applied (the delta method), a single
flat percentage cannot simultaneously be tight enough to catch a real formula bug *and* loose enough
to avoid flaky failures across a fixed set of seeds. Whoever writes such a test under time pressure
tends to err toward looseness — which is exactly the failure mode that matters: a genuine bug in the
math can pass a loose flat-percentage test just as easily as ordinary sampling noise can, so the test
provides much less assurance than it appears to.

## Fix

Tolerances were re-derived from the estimator's known sampling theory instead of asserted by feel:

- **`OrnsteinUhlenbeck.fit()`**: Hamilton's classical AR(1)-OLS asymptotic result
  (`sqrt(n)*(b_hat - b) -> N(0, 1 - b^2)`) gives `Var(b_hat)`, propagated through the nonlinear
  `theta`/`mu`/`sigma` back-substitution formulas via the delta method (with `Var(s2)` for the
  residual variance handled the same chi-squared-type way `assertSampleMoments`'s `tolVariance`
  already does).
- **`CoxIngersollRoss.fit()`**: the identical AR(1)-OLS delta-method chain for `kappa`/`theta`
  (stage 1 is mathematically identical to OU's), plus a documented, explicitly-flagged-as-partially-
  conservative derivation for `sigma`'s stage-2 regression uncertainty (CLS's second-moment
  regression doesn't have as clean a textbook asymptotic-variance result as stage 1, so the fix
  states plainly which part is rigorously derived and which part is a justified conservative bound,
  rather than presenting a fabricated formula as if it were equally rigorous).

Both fixes were verified not just against the three fixed `MOMENT_SEEDS`, but against a wider
random-seed sweep, to confirm the derived tolerance isn't narrowly tuned to only the asserted seeds.

## Prevention Strategy

For any test asserting that an estimator recovers a known "true" parameter from finite synthetic
data:

1. Derive the tolerance from the estimator's known (or a documented conservative upper bound on its)
   sampling variance — never a flat round-number percentage chosen by feel.
2. If the exact asymptotic variance isn't tractable for some part of the estimator, say so directly
   in a comment, and be explicit about which part of the derivation is proven and which part is a
   conservative bound — don't present a plausible-looking formula as equally rigorous as one that
   was actually derived.
3. Validate the chosen tolerance against more than just the fixed seeds asserted in the test (a
   quick random-seed sweep during development is enough) to confirm it isn't accidentally tuned to
   pass only for those particular seeds.
4. Treat a flat-percentage tolerance on a statistical recovery test as a review smell on the same
   tier as a tautological reference value (a formula copied from the implementation into the test) —
   both quietly widen the test's blind spot for real bugs while still looking like a meaningful
   assertion.

## Related Solutions

None found directly on this exact pattern; the closest existing convention is the
`assertSampleMoments`/`K_SIGMA` CLT-derived tolerance style already established in `test/process.js`
for simulation-based moment checks, which this fix extended to OLS-regression-based parameter
recovery.

## Key Insight

A flat percentage tolerance on a parameter-recovery test is not a "relaxed" version of a CLT-derived
tolerance — it is a strictly weaker claim that can hide a systematic formula bug of exactly the
magnitude the flat band happens to be loose by, so recovery-test tolerances must always be derived
from the estimator's actual sampling variance, never chosen by feel.
