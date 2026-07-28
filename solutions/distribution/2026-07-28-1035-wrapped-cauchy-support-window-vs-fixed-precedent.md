---
date: 2026-07-28T10:35:35Z
category: "distribution"
problem: "Fixed [-pi,pi] support copied from VonMises broke WrappedCauchy's CDF for mu != 0"
status: complete
related_issue: "#1135"
related_plan: "thoughts/plans/2026-07-28-0930-wrapped-cauchy.md"
tags: [circular-distribution, support, wrapped-cauchy, von-mises, atan2, location-parameter, precision-refs]
---

# Solution: WrappedCauchy support window must be centred on its location parameter, not copied from VonMises's fixed precedent

**Date**: 2026-07-28T10:35:35Z
**Category**: distribution
**Related Issue**: #1135

## Problem

While implementing `WrappedCauchy` (issue #1135), the plan declared `this.s` as a fixed
`[-pi, pi]` support — copied directly from `VonMises`, the codebase's only other circular
distribution. Running `scripts/precision-refs-continuous.py` to generate mpmath reference
values for the precision gate immediately produced nonsense for any parameter set with
`mu != 0`: `pdf` evaluated to 0 at points that should have had substantial density, and the
script's bisection-based `invcdf()` collapsed quantile estimates to the support boundary
instead of the true value.

## Root Cause

The standard closed-form wrapped-Cauchy CDF —
`F(x) = 0.5 + atan2((1+rho)*sin(d/2), (1-rho)*cos(d/2)) / pi`, where
`d = atan2(sin(x-mu), cos(x-mu))` — is only continuous and monotonic on a window **centred
at `mu`**, i.e. `(mu-pi, mu+pi)`. The `atan2`-based wrap has a genuine branch discontinuity
(a jump of exactly 1 in `F`) located at `x = mu + pi (mod 2*pi)`.

`VonMises`'s fixed `[-pi, pi]` support is safe only because `VonMises` has no location
parameter at all — its density's mode is fixed at 0 (`exp(kappa*cos(x))`), so its one and
only discontinuity-free window is always `[-pi, pi]` regardless of any other parameter.
Copying that fixed-support convention to `WrappedCauchy`, which does have a free `mu`,
silently assumed the two distributions share a property they do not: for any `mu != 0`, the
CDF's discontinuity lands **inside** the declared `[-pi, pi]` domain, breaking monotonicity
there and defeating any bisection/root-finding quantile solver operating on that domain.

## Fix

Declare the support as parameter-dependent, centred at `mu`, rather than fixed:

```js
this.s = [
  { value: mu - Math.PI, closed: true },
  { value: mu + Math.PI, closed: true }
]
```

This matches scipy's own `vonmises(loc=mu)` convention (documented support
`(-pi+loc, pi+loc)`) and is a completely standard codebase pattern already used by other
parameter-dependent-support distributions (e.g. `Uniform`, `Triangular`) — nothing exotic,
just recognizing that `this.s` must track whichever parameter shifts the density's domain.

The bug was caught and fixed *before* any `src/dist/wrapped-cauchy.js` implementation code
was written, purely because the TDD-mandated precision-reference-generation step
(`scripts/precision-refs-continuous.py`, run before the Green phase) exercised the
bisection-based `invcdf()` against the wrong support and surfaced the discontinuity
immediately.

Two smaller, related lessons surfaced later in the same session:

1. `_fitInit`'s `Math.atan2(S, C)` mu-estimator always returns the canonical representative
   of `mu` in `(-pi, pi]`, but `mu` is deliberately left unconstrained (any real value is
   valid, matching the periodic nature of circular data). Fitting data sampled from an
   off-canonical `mu` (e.g. `mu=4`) therefore needs the canonical estimate shifted by the
   nearest multiple of `2*pi` toward the data's own arithmetic mean — the base `Distribution`
   class's `fit()`/`pdf()`/`cdf()` machinery operates on literal real-number support windows,
   not mod-2*pi-aware ones.
2. Testing the CDF exactly at the support boundary (`x = mu +/- pi`) is a fragile cross-tool
   (mpmath vs. JS) precision-gate reference point: `Math.PI` and mpmath's higher-precision
   `pi` round differently right at the literal discontinuity, so an exact-boundary reference
   value isn't reliably reproducible across tools even though each tool is internally
   self-consistent. The robust fix is probing 1e-9 inside the boundary instead of exactly at
   it (verified numerically to agree between JS and mpmath to ~1e-16).

## Prevention Strategy

When copying a support/domain declaration (`this.s`) from a precedent distribution during
planning or implementation, explicitly check whether the precedent has every parameter the
new distribution has. A fixed support is only safe to copy verbatim if the precedent has no
parameter that could shift the density's location — the moment a location-type parameter
(`mu`, `loc`, `x0`, etc.) enters the picture, ask whether the CDF's periodic-wrap
discontinuity (or any other formula-inherent break point) is anchored to that parameter
rather than to the fixed coordinate origin.

More generally: for any circular/periodic distribution with a closed-form `atan2`-based CDF,
derive the support declaration from *where the branch cut of the wrap actually is*, don't
copy it from a sibling distribution's support literal. Running the precision-reference-
generation step (or any independent bisection/root-finding check against `_cdf`) before
writing the actual `_pdf`/`_cdf`/`_q` implementation — as TDD already mandates here — is what
caught this before it shipped; don't skip or defer that step for a distribution that "looks
like" an existing precedent.

## Related Solutions

- `solutions/correctness/2026-07-26-1339-vonmises-cdf-oscillating-term-premature-convergence.md` — a different VonMises CDF defect (Fourier-series truncation), same distribution family but an unrelated mechanism (series convergence vs. support-boundary placement).
- `solutions/testing/2026-05-18-1415-bounded-circular-special-shape-refvals-scipy-numpy.md` — establishes that circular distributions need extra care around their CDF's behavior near boundary/periodic points; this case extends that lesson to the support *declaration* itself, not just reference-value tolerances.

## Key Insight

A parameter-free precedent's fixed support (`VonMises`'s `[-pi, pi]`) is not transferable to
a distribution with a location parameter (`WrappedCauchy`'s `mu`) — for any distribution
whose closed-form CDF is built from a periodic `atan2` wrap, the support must be centred on
the location parameter (`[mu-pi, mu+pi]`), because that is exactly where the wrap's branch
discontinuity lives, and a fixed support is only safe when the discontinuity and the declared
boundary coincide for lack of a location parameter, not by coincidence of the formula.
