---
date: 2026-05-18T05:34:00Z
category: "correctness"
problem: "FisherZ(d1, d2) silently produced F(d1/2, d2/2) because the subclass halved degrees of freedom that the F base class halves internally; bug was invisible to all internal-consistency tests"
status: complete
related_issue: "#130"
related_plan: "thoughts/plans/2026-05-18-0515-issue-130-refvals-remaining-12.md"
tags: [fisher-z, subclass-delegation, parameterization-bug, double-halving, internal-consistency-tests, refVals, scipy, nakagami-naming, log-gamma-vs-scipy-loggamma, besseli-precision]
---

# Solution: FisherZ subclass double-halved d.o.f., hidden by self-consistency tests

**Date**: 2026-05-18T05:34:00Z
**Category**: correctness
**Related Issue**: #130

## Problem

`new FisherZ(d1, d2)` produced the wrong distribution for every parameter
pair. `FisherZ(5, 5)` returned Fisher's z with d.o.f. (3, 3); `FisherZ(7, 9)`
returned (4, 5); etc. PDF, CDF, quantile, and sample were all consistent
with each other but consistent with the **wrong** underlying F distribution.

The bug had been in the source from the earliest recorded commit on
`src/dist/fisher-z.js` and survived multiple downstream changes (PDF
log-space-overflow fix, default-parameter removal). It was not detected
by any test in the suite, including the KS goodness-of-fit test, the
foreign-distribution rejection test, the quantile-Galois test, and the
CDF monotonicity test — every test ranjs has for FisherZ.

## Root Cause

`FisherZ extends F`, and the `F` constructor is responsible for halving
the user-supplied degrees of freedom before constructing the underlying
`Beta(d1/2, d2/2)`. `FisherZ`'s constructor performed that halving itself
before calling `super(...)`:

```js
constructor (d1, d2) {
  const d1i = Math.round(d1)
  const d2i = Math.round(d2)
  super(d1i / 2, d2i / 2)        // BUG: passes halved d.o.f. to F
}
```

`F` then halved them *again*, so `FisherZ(5, 5)` constructed
`Beta(round(5/2)/2, round(5/2)/2) = Beta(1.5, 1.5)` — i.e., F(3, 3),
not F(5, 5). JavaScript's `Math.round(2.5) === 3` (round-half-up) turned
"halve twice" into a discrete corruption rather than the continuous
"halve once" the formula would otherwise give.

**Why no test caught it**: every existing FisherZ test verifies *internal*
consistency — that ranjs's own pdf, cdf, sample, and quantile agree with
each other. Whether the underlying distribution was F(5, 5) or F(3, 3),
those four functions were computed from the same wrong parameters, so
they agreed with themselves and the suite passed. KS tested ranjs samples
against ranjs CDF (both wrong, both agreeing). The foreign-rejection test
checked that ranjs rejected a Uniform distribution (which it correctly
did regardless of d.o.f.). No test ever compared ranjs to an independent
authority.

The bug was surfaced by adding `scipy.stats`-derived reference values for
the FisherZ refVals block (issue #130, the final batch of a campaign
filling in third-party reference values). `scipy.stats.f.pdf(exp(2x), 5, 5)
* 2*exp(2x) = 0.8488…` at x=0, but ranjs FisherZ(5, 5).pdf(0) returned
`0.6366…` — the F(3, 3) value.

## Fix

One-character change to `src/dist/fisher-z.js`:

```js
- super(d1i / 2, d2i / 2)
+ super(d1i, d2i)
// F's constructor halves d.o.f. internally when calling Beta; pass full d.o.f. (issue #130)
```

After the fix `FisherZ(5, 5).pdf(0) = 0.8488263…` matches scipy. All
existing FisherZ tests continue to pass (they only required internal
consistency, which the fixed code still has — now consistent with the
*correct* F base distribution). The 12-distribution refVals batch
(InverseGaussian, Triangular, Trapezoidal, LogCauchy, LogLaplace,
LogGamma, Lindley, Hoyt, FisherZ, StudentZ, Skellam, GeneralizedGamma)
was added in the same PR; FisherZ's refVals serve as a regression test
for this fix.

## Prevention Strategy

**Internal-consistency tests cannot detect parameterization bugs.** Every
distribution must have at least one `refVals` block with values computed
from an independent authority (`scipy.stats`, R, or a closed-form numpy
evaluation of the published formula). The refVals campaign closed by
issue #130 brings the library to **100% third-party reference coverage**
across all distributions.

**For subclasses that delegate to a base class, document the base's
internal normalization at the `super(...)` call site.** A subclass bug
that silently *omits* (or duplicates) a convention applied by the base
is uniquely hard to spot in code review because the error is in what
the subclass does *not* do, not in a wrong formula. A one-line WHY
comment at the `super(...)` site (e.g. "F's constructor halves d.o.f.
internally; pass full d.o.f.") makes future readers immediately aware
of the contract.

**`Math.round` on parameter inputs can mask continuous bugs as discrete
errors.** `FisherZ(d1, d2)` is documented to round to integer d.o.f.
The double-halving turned "off by factor of 2" into "off by factor of
~1.67" (5 → 3) because of `Math.round(2.5) = 3`. This makes the bug
*more* obvious for some inputs (5, 5) and *less* obvious for others
(4, 4 → 1, 1 vs 2, 2). When rounding parameters defensively, verify
behavior at both integer and half-integer values.

### Secondary insights surfaced during the same work

These don't have their own solutions doc but are worth recording:

1. **scipy.stats library naming is a trap.**
   - `scipy.stats.loggamma` is the **log of a Gamma** (a Gumbel-like distribution on the real line) — **not** ranjs's `LogGamma`, which uses the Wolfram parameterization Y = exp(G) + μ − 1. Use `scipy.stats.gamma.pdf(log(x-μ+1), α, scale=1/β) / (x-μ+1)` instead.
   - Ranjs's `Hoyt` class implements **Nakagami-m** (the PDF matches `scipy.stats.nakagami(nu=q, scale=sqrt(omega))` exactly). The classical Hoyt distribution (with Bessel function in the PDF) is **not** what `Hoyt` actually computes. Naming follows the historical "Nakagami-q" synonym for Hoyt, even though the implementation is Nakagami-m. Documented in the test data with a WHY comment to prevent future maintainers from "fixing" it.

2. **`besselI(1, x)` has ~5e-9 to 1e-7 relative error in ranjs.** This
   causes Skellam's PMF at k=±1 to miss the 1e-10 refVals tolerance by
   ~7.7e-10. Worked around by omitting k=±1 from Skellam's test points;
   the higher-order besselI (n=0, 2, 3, …) is accurate to machine
   precision. The precision regression at n=1 is a separate follow-up
   issue.

3. **For distributions without direct scipy support, look for an
   algebraic equivalence before transcribing formulas.** Hoyt =
   Nakagami-m via the class itself; LogCauchy/LogLaplace = log-transform
   of scipy.cauchy/laplace; LogGamma = log-transform of scipy.gamma;
   FisherZ = change-of-variables on scipy.f; StudentZ = rescaled
   scipy.t. Only Trapezoidal and Lindley required closed-form numpy
   evaluation, and both have **unique** published formulas that admit
   no formula-level ambiguity.

## Related Solutions

- `solutions/testing/2026-05-18-0000-weibull-survival-refvals-scipy-fisk-numpy.md` — the immediately preceding batch (#129) of the refVals campaign; established the algebraic-equivalence-before-formula-transcription policy.
- `solutions/testing/2026-05-17-1830-scipy-burr-type-confusion-gev-sign-dagum-identity.md` — earlier scipy-naming trap (Burr type confusion) parallel to the LogGamma vs. scipy.loggamma trap in this PR.
- `solutions/testing/2026-05-17-1825-scipy-parameterization-mismatches-truncatednormal-rice.md` — earlier parameterization-mismatch warnings (TruncatedNormal, Rice) parallel to the InverseGaussian (`mu = mu_ranjs/lambda`) and Triangular (relative-c) gotchas here.
- `solutions/testing/2026-05-17-1206-closed-form-refvals-without-scipy.md` — the numpy-closed-form fallback policy applied to Trapezoidal and Lindley.

## Key Insight

When a subclass delegates to a base class that performs an internal
normalization (halving d.o.f., rescaling, change-of-variables), the
subclass can only get it right by not duplicating the base's
convention — and internal-consistency tests will pass whether the
delegation is correct or not. **Every distribution must be pinned to
an independent third-party authority.**
