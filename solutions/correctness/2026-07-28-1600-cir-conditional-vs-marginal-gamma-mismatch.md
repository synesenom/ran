---
date: 2026-07-28T16:00:00Z
category: "correctness"
problem: "Issue #1133 asked for CoxIngersollRoss.fit() to use 'conditional MLE via the gamma transition density', but that density is not the true conditional transition"
status: complete
related_issue: "#1133"
related_plan: "thoughts/plans/2026-07-28-1530-process-fit.md"
tags: [cox-ingersoll-ross, noncentral-chi-squared, conditional-vs-marginal, gamma-distribution, process-fit, cls]
---

# Solution: CIR's Gamma density is a marginal, not a conditional transition — CLS instead of the issue's literal ask

**Date**: 2026-07-28
**Category**: correctness
**Related Issue**: #1133

## Problem

Issue #1133 explicitly specified: `CoxIngersollRoss`: estimate parameters using conditional MLE
via the gamma transition density. Implementing this literally would have wired `fit()`'s
conditional-likelihood computation to the `Gamma` density already coded in
`cox-ingersoll-ross.js`'s `pdf(x,t)`/`marginal(t)`. That Gamma density is real and correctly
implemented — but it is the *marginal* distribution of `X_t` given the process always starts at
`x0 = 0` (hardcoded in the constructor), not the one-step *conditional* transition density of
`X_{n+1}` given an arbitrary previously-observed `X_n` from a real path. Fitting from a path means
conditioning on whatever nonzero value the path actually visited at each step — using the Gamma
density there would silently drop the dependence on the previous observation entirely.

## Root Cause

CIR's true one-step conditional transition is a scaled noncentral chi-squared:

```
X_{n+1} | X_n  ~  (1/c) * NoncentralChi2(df, lambda)
c   = 2*kappa / (sigma^2 * (1 - exp(-kappa*dt)))
df  = 4*kappa*theta / sigma^2                    (generally non-integer)
lambda = 2*c*X_n*exp(-kappa*dt)                  (depends on the previous observation)
```

The Gamma density is the special case `lambda = 0`, which only happens when the conditioning value
is exactly `0` — true for the *marginal* of a process hardcoded to `x0 = 0`, but not true in general
for a conditional step starting from a nonzero, previously-observed path value. The marginal and
the conditional coincide only at that one degenerate conditioning point; superficially, "the process
has a Gamma-shaped marginal" is easy to misremember as "the process has a Gamma-shaped transition."

Compounding the trap: even a *correct* conditional-MLE approach couldn't have reused
`ran.dist.NoncentralChi2` as-is, because that class rounds its `k` (degrees of freedom) parameter to
the nearest integer (documented in `solutions/distribution/2026-05-28-1902-noncentral-fitinit-mom-stability.md`),
and CIR's `df = 4*kappa*theta/sigma^2` is generally non-integer. The "obvious" existing building
block for the textbook-correct estimator doesn't actually exist in this codebase yet.

## Fix

The research phase (`thoughts/research/2026-07-28-1500-process-fit.md`) worked out the exact
conditional transition density and flagged the mismatch with the issue's literal wording as an open
design question *before* any implementation code was written. Planning (with `design-propose`/
`design-critique`) then chose Conditional Least Squares (Overbeck & Rydén, 1997) — a fully
closed-form, two-stage OLS estimator that matches the conditional mean and conditional variance
(both provably affine in `X_n`) rather than the full conditional likelihood. This avoids introducing
new noncentral-chi-squared machinery (which CLAUDE.md's "Prerequisite extraction" pattern would
have required splitting into its own issue) while still shipping a statistically consistent
estimator for all four processes in one PR. Both the JSDoc (`cox-ingersoll-ross.js`'s `static fit()`)
and the CHANGELOG entry explicitly name it "Conditional Least Squares, not exact MLE" so callers
aren't misled about efficiency guarantees — see `decisions/0044-process-fit-static-factory.md`.

## Prevention Strategy

When an issue names a specific statistical object by name ("the gamma transition density",
"conditional MLE via X"), treat that name as a claim to verify during research, not an instruction
to implement literally:

1. Check whether the named object is well-defined for the *exact* use case at hand — conditional vs.
   marginal is the classic trap, as is assuming a distribution's shape at one special-case parameter
   value (here, `x0 = 0`) generalizes to the shape at every parameter value.
2. Check whether the codebase's existing machinery can actually represent that object without silent
   degradation (e.g. a distribution class that quietly rounds a continuous parameter to an integer).
3. If the named object turns out not to correspond to what's actually needed, surface this
   explicitly as a research/design finding — including in an ADR if it changes public API behavior —
   rather than implementing something close enough and hoping it holds up under scrutiny.
4. Cross-reference prior solution files for "distribution X can't represent Y" — this exact
   integer-rounding limitation on `NoncentralChi2` had already been documented once and directly
   determined the shape of this fix.

## Related Solutions

- `solutions/distribution/2026-05-28-1902-noncentral-fitinit-mom-stability.md` — documents
  `NoncentralChi2`'s integer-rounding of `k`, the concrete reason a true conditional MLE for CIR
  isn't a drop-in reuse of an existing distribution class.
- `decisions/0040-process-marginal-distribution-instance.md` — the ADR that first introduced CIR's
  `x0=0`-dependent Gamma marginal and explicitly flagged its fragility if `x0` ever became
  configurable — the same fragility that made the marginal unsuitable for conditional inference here.

## Key Insight

A distribution's marginal density and its conditional transition density coincide only at
special/degenerate parameter values (here, the conditioning state `x0 = 0`) — reusing a marginal
formula for conditional inference on general path data silently drops the noncentrality/dependence
structure and produces a biased estimator, so any "transition density" claim in a spec must be
verified against the genuinely *conditional* object before implementation begins.
