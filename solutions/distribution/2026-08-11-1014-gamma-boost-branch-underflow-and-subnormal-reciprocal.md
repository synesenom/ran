---
date: 2026-08-11T10:14:31Z
category: "distribution"
problem: "InverseGamma/Gamma sample() emitted 0/Infinity for tiny shape parameters"
status: superseded
superseded_by: "solutions/algorithm/2026-08-11-1830-boostedgamma-infinite-loop-and-downstream-boundary-cascade.md"
related_issue: "#1379"
related_plan: "thoughts/plans/2026-08-11-0845-issue-1379-gamma-small-shape-underflow.md"
tags: [gamma-sampler, boost-branch, underflow, subnormal, reciprocal-overflow, rejection-sampling, inverse-gamma, beta-prime, student-t, tdd]
---

# Solution: Gamma boost-branch underflow and subnormal-reciprocal overflow

**Date**: 2026-08-11T10:14:31Z
**Category**: distribution
**Related Issue**: #1379

## Problem

`InverseGamma.sample()` (and, as a bug-triage pass during the same branch
found, `BetaPrime.sample()` and `StudentT.sample()`) could emit exact `0`
or `Infinity` for small-shape parameters — values outside each
distribution's own documented open `(0, Infinity)` support — despite the
underlying gamma draw being mathematically valid. At `alpha ≈ 0.0102`
(the issue's worked example) this happened for roughly 0.05% of draws: a
rate high enough to be caught reliably by a fixed-seed regression test,
but easy to miss with casual spot-checking or a single unseeded sample.

## Root Cause

Two **independent** floating-point failure modes chain through
`src/dist/_gamma.js`'s small-shape (`a < 1`) boost identity
`X · U^(1/a)` for `X ~ Gamma(a+1)`, `U ~ Uniform(0,1)`:

1. **Underflow in the boost factor itself.** For tiny `a`, `1/a` is huge,
   so `Math.pow(u, 1/a)` underflows to exact `0.0` for a measurable
   fraction of `u ∈ (0,1)` draws. The product is then exactly `0` — a
   value formally outside `Gamma`'s open support, produced by the
   sampling *algorithm*, not by the distribution's true density.
2. **Overflow when a valid-but-subnormal draw is transformed.** Even a
   *nonzero* gamma draw can land in the IEEE-754 subnormal range (below
   `1/Number.MAX_VALUE`). It is a perfectly valid member of `Gamma`'s
   support — but any downstream *consumer* that reciprocates or divides
   by it overflows to `Infinity`: `1/x` in `InverseGamma._generator()`,
   `x/y` in `BetaPrime._generator()`, or dividing by a `gamma(r, nu/2)`
   draw in `StudentT._generator()`. This is a failure of the *transform*,
   not of the underlying draw.

These are genuinely distinct failure modes, not two symptoms of one bug.
This was only discovered because TDD's first fix attempt — rejecting only
`result === 0` inside `_gamma.js`'s boost branch — made the `Gamma.sample()`
regression test pass but left the `InverseGamma.sample()` regression test
still failing (`x = Infinity` at seed 42). Fixing failure mode 1 did not
imply a fix for failure mode 2.

## Fix

Two independent rejection-sampling guards, each mirroring the
Marsaglia-Tsang rejection-loop idiom already present in `_gamma.js`:

- Extracted a `boostedGamma(r, a, b)` helper in `src/dist/_gamma.js` that
  loops `do { result = gamma(r, a+1, b) * Math.pow(r.next(), 1/a) } while (result === 0)`,
  rejecting exact-zero underflow at the source. This alone protects every
  consumer of the shared helper that uses the raw draw directly (`Gamma`,
  `Chi2`, `Erlang`, etc.) — including ones with no reciprocal/ratio
  exposure.
- Added a **second, separate** `Number.isFinite` guard directly at each
  *consuming transform*: `InverseGamma._generator()`
  (`do { x = 1/super._generator() } while (!Number.isFinite(x))`),
  `BetaPrime._generator()` (reject a non-finite `x/y`), and
  `StudentT._generator()` (reject a non-finite ratio). These guard the
  reciprocal/ratio operation itself, not the underlying gamma draw —
  because the underlying draw is already valid by the time it reaches
  them; the loss of representability happens one step later, in the
  transform.

Both guard types redraw from the full joint distribution on rejection
(the entire boost-branch expression, or the entire `_generator()` call),
which preserves the correct marginal law: the true distribution assigns
probability 0 to the rejected event in every case, so conditioning on
"not rejected" changes nothing about the limiting distribution — confirmed
empirically by the full `ksTest`/`chiTest` suite continuing to pass at
existing tolerances and seeds for every affected distribution.

A bug-triage pass caught that the *same* subnormal-reciprocal/ratio
failure mode (mode 2 above) also reaches `BetaPrime` and `StudentT`
through the identical shared `_gamma.js` helper, and fixed both with the
same pattern in a follow-up commit on the same branch.

**Not fixed here** (filed separately as issue #1384, explicitly out of
scope): for `alpha` below roughly `1e-12`, the boost branch's rejection
loop becomes a *true* infinite loop, not just a slow one — at that shape,
literally none of the PRNG's 2^32 possible outputs survive
`Math.pow(u, 1/a)` underflow, so the loop has zero acceptance probability.
Issue #1379's own acceptance criteria only required correctness down to
`alpha = 0.01`, four-plus orders of magnitude away from where this
becomes reachable; #1384 tracks a genuinely different fix (e.g. a
log-space reformulation of the boost factor).

## Prevention Strategy

When a sampler composes an inner distribution's variate via a transform
that can **amplify magnitude** (reciprocal, ratio, division) — as opposed
to consuming the inner variate directly — check both ends of the
composition independently for a domain-boundary failure:

1. Does the inner sampling **algorithm itself** (not just its
   distribution) have a numerically-representable failure mode near its
   own parameter boundary (e.g. `pow(u, 1/a)` underflow for tiny `a`)?
2. Does the **transform applied to a valid inner draw** have its own,
   separate failure mode (e.g. reciprocating a subnormal-but-valid
   value)?

Fixing one does not fix the other. Verify with a regression test that
exercises the actual extreme-parameter regime (a specific worked-example
`alpha`, not just a symbolic "shape `< 1`" case), swept across the
project's fixed `SEEDS = [0, 42, 12345]`. If a fix makes one such test
pass but a related one (e.g. a downstream reciprocal consumer) still
fails, treat that as the signal to look for a **second, distinct** root
cause — not as evidence the first fix is incomplete or buggy.

Any other `_generator()` built on `_gamma.js` via a reciprocal or ratio
(`grep` for `1 / ` or `/ gamma(` composition in `src/dist/`) is a
candidate for the same subnormal-reciprocal audit; this fix covers the
three reachable cases found by an explicit 20-file audit
(`InverseGamma`, `BetaPrime`, `StudentT`) but a new distribution added
later that composes `_gamma.js`'s output the same way should re-check
this failure mode rather than assume the shared helper alone is
sufficient protection.

## Related Solutions

- `solutions/distribution/2026-05-16-1851-gamma-sampler-boundary-α=1.md`
  (issue #193) — fixed an **unrelated** bug in the same file (the
  `a > 1` vs `a >= 1` Marsaglia-Tsang dispatch boundary). That fix and
  its prevention guidance remain fully correct and independent of this
  one; both live in `src/dist/_gamma.js` but address different code
  paths (dispatch boundary vs. boost-branch underflow/subnormal-reciprocal
  overflow) — this solution does **not** supersede it.
- `solutions/testing/2026-05-23-0548-noncentral-beta-alpha-lt1-ad-noise-refvals-verification.md` —
  precedent used during this fix's own testing follow-up: `BetaPrime`'s
  extreme-`beta` case was found to fail its GoF (Anderson-Darling) test
  not from a sampler defect but because `beta < 1` gives it an infinite
  mean, so a sampled tail routinely reaches `x > 1e15`, where `_cdf`'s
  `x/(1+x)` transform saturates to exactly `1.0` in float64 — a
  **different**, unrelated precision ceiling in the CDF. Documented as a
  deliberate GoF exclusion rather than a forced-in flaky test, following
  the same category of exclusion this precedent established.

## Key Insight

A composed sampler (`inner distribution` → `transform`) has two
independent domain-boundary failure sites — the inner algorithm's own
underflow near its parameter boundary, and the transform's overflow when
applied to an inner draw that is valid-but-subnormal — and each needs its
own `while (result === 0)` / `while (!Number.isFinite(...))` rejection
guard, because fixing one does not fix the other.
