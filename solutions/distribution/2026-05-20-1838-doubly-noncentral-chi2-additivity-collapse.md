---
date: 2026-05-20T18:38:23Z
category: "distribution"
problem: "Issue asked for a double-summation DoublyNoncentralChi2, but the noncentral chi-square is closed under addition so the double series collapses to a single noncentral chi-square"
status: complete
related_issue: "#228"
related_plan: "thoughts/plans/2026-05-20-1818-issue-228-doubly-noncentral-chi2.md"
tags: [doubly-noncentral, noncentral-chi2, reproductive-property, additivity, poisson-mixture, closed-form-reduction, distribution-as-sum, save-load, composition-pitfall]
---

# Solution: DoublyNoncentralChi2 collapses to a single noncentral chi-square

**Date**: 2026-05-20T18:38:23Z
**Category**: distribution
**Related Issue**: #228

## Problem

Issue #228 asked to implement a new `DoublyNoncentralChi2` distribution — the law
of `X = U + V` with `U ~ ncχ²(k1, λ1)` and `V ~ ncχ²(k2, λ2)` independent — and
explicitly instructed: "Add `src/dist/doubly-noncentral-chi2.js` ... Pattern
after `src/dist/doubly-noncentral-beta.js` (outward double summation)", i.e.
implement the literal double Poisson series

```
f(x; k1, k2, λ1, λ2) = e^{-(λ1+λ2)/2} Σ_j Σ_l (λ1/2)^j (λ2/2)^l / (j! l!)
                       · f_χ²(x; k1 + k2 + 2j + 2l).
```

Following that instruction literally would have produced a ~250-line nested
outward summation (the `doubly-noncentral-beta.js` pattern) that is **provably,
numerically identical** to a one-line closed-form evaluation — slower by orders
of magnitude, harder to test for convergence, and with zero accuracy benefit.

## Root Cause

The issue generalized from the doubly-noncentral *F / beta / t* family, where
the two chi-squares enter a **ratio** and the double Poisson sum genuinely
cannot collapse — there the `doubly-noncentral-beta.js` double summation is the
only option. But the doubly-noncentral *chi-square* is a **sum** of two
independent noncentral chi-squares, and the noncentral chi-square family is
**closed under addition** (the reproductive property — Johnson, Kotz &
Balakrishnan, *Continuous Univariate Distributions* Vol. 2, §29.2).

The double series collapses in four standard steps:

1. `ncχ²(k, λ)` is a Poisson(`λ/2`) mixture of central `χ²(k + 2j)`.
2. Central χ² is additive in degrees of freedom: conditional on Poisson counts
   `j, l`, `X = U + V ~ χ²(k1 + k2 + 2j + 2l)`.
3. Independent Poissons add: `j ~ Poisson(λ1/2)`, `l ~ Poisson(λ2/2)` give
   `j + l ~ Poisson((λ1+λ2)/2)`.
4. The binomial theorem collapses the inner sum:
   `Σ_{j+l=m} (λ1/2)^j (λ2/2)^l / (j! l!) = ((λ1+λ2)/2)^m / m!`.

Result: `DoublyNoncentralChi2(k1, k2, λ1, λ2) ≡ NoncentralChi2(k1+k2, λ1+λ2)`,
exactly. The issue's stated approach was never checked against this property.

## Fix

`DoublyNoncentralChi2` was implemented as a standalone `extends Distribution`
(matching `DoublyNoncentralBeta`/`DoublyNoncentralT`) that evaluates the single
closed form for `ncχ²(k1+k2, λ1+λ2)`:

- The constructor precomputes the collapsed parameters into
  `this.c = [k1+k2, λ1+λ2, kEven]`.
- `_cdf` is one `marcumP(c[0]/2, c[1]/2, x/2)` call — **no `λ=0` branch needed**:
  `marcumP` with second argument 0 reduces naturally to the central χ² CDF.
- `_generator` is one `noncentralChi2(this.r, c[0], c[1])` sampler call (the
  helper handles `λ=0` via `Poisson(0)=0`).
- `_pdf` duplicates ~12 lines of the Bessel even/odd formula from
  `NoncentralChi2._pdf`, plus an explicit central-χ² branch for `λ1+λ2 = 0`
  (which `NoncentralChi2` itself forbids via `lambda > 0` validation, and whose
  Bessel form divides by `λ`).

The collapse was numerically verified before embedding reference values: the
literal double Poisson series (computed with `scipy.stats.chi2`) matched
`scipy.stats.ncx2(k1+k2, λ1+λ2)` to a worst error of **6.66e-16** across the
test grid. `refVals` were then sourced from `scipy.stats.ncx2` directly — a
legitimate third-party cross-check, since `ncx2` is independent of ranjs.

Final file: 90 lines; whole diff 126 lines — far under the 400-line cap that a
double summation would have approached.

**Rejected alternative — composition.** Holding a private `NoncentralChi2` /
`Chi2` instance and delegating `_pdf`/`_cdf` to it was rejected: the base-class
`load()` (`src/dist/_distribution.js`) restores only `this.p`, `this.c`, and
`this.s`. A child `Distribution` instance held in any other field is invisible to
`load()` and goes **stale silently** after state restoration, returning wrong
results. Subclassing `NoncentralChi2` was also rejected — its constructor
rejects `λ ≤ 0`, so supporting the valid `λ1=λ2=0` input would require a
cross-cutting change to a stable distribution (out of single-issue scope).

## Prevention Strategy

1. **When a distribution is defined as a *sum* of two independent members of the
   same family, check the reproductive (additivity) property first.** Noncentral
   chi-square, Gaussian, Poisson, gamma (fixed rate), and negative binomial are
   all closed under addition — any "doubly noncentral" or "compound" variant
   built from a *sum* of those collapses to a single-parameter call. Only
   *ratios*, *products*, and non-additive mixtures (doubly-noncentral F/beta/t)
   genuinely need a double series.

2. **Treat an issue's stated implementation technique as a suggestion, not a
   spec.** Issue #228 said "pattern after the double-summation sibling"; the
   correct move was to verify the math, find the closed form, deviate, and
   document the deviation in the plan and PR. The *deliverable* (a working
   `DoublyNoncentralChi2` class) is the spec; the *technique* is not.

3. **Parameter-derived state must live in `this.p` / `this.c` / `this.s`.** The
   base-class `load()` restores only those three. Never stash a held child
   `Distribution` instance, a cached object, or any other auxiliary state
   outside them — it survives construction but not `load()`, producing silently
   wrong output after `save`/`load`.

## Related Solutions

- `solutions/testing/2026-05-18-0712-noncentral-refvals-doubly-poisson-mixture-scaling.md`
  — the immediate ancestor: it added `refVals` to the 7 existing noncentral
  distributions and explicitly filed the missing `DoublyNoncentralChi2` as #228.
  It established `scipy.stats.ncx2` as the direct reference for `NoncentralChi2`
  and the cross-validate-before-embedding workflow reused here.

## Key Insight

When an issue says "pattern after the double-summation sibling," verify the
reproductive property first — the noncentral chi-square is closed under
addition, so `DoublyNoncentralChi2(k1,k2,λ1,λ2)` is exactly
`NoncentralChi2(k1+k2,λ1+λ2)` and the double summation is provably redundant,
unlike the doubly-noncentral beta/F/t where the chi-squares sit in a ratio and
no collapse exists.
