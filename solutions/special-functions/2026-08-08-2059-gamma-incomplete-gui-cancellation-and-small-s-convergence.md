---
date: 2026-08-08T20:59:49Z
category: "special-functions"
problem: "gammaUpperIncomplete's _gui lost precision (Skellam cdf near k≈mu1) from two additive bugs: MAX_ITER=100 truncation and an O(s)-magnitude prefactor cancellation, plus a third latent bug at s→0 found while fixing the first"
status: complete
related_issue: "#1348"
related_plan: "thoughts/plans/2026-08-08-1704-skellam-cdf-marcum-precision-cliff.md"
tags: [gamma-incomplete, marcum-q, skellam, continued-fraction, max-iter, cancellation, loader, stirlerr, bd0, log1pmx, convergence]
---

# Solution: gammaUpperIncomplete's `_gui` — cancellation and two convergence-budget failure modes (#1348)

**Date**: 2026-08-08T20:59:49Z
**Category**: special-functions
**Related Issue**: #1348

## Problem

`Skellam(5000, 1).cdf(k)` lost 3-4 orders of magnitude of precision (5e-10 to 6e-9 relative
error, vs. the library's ~1e-12 to 1e-14 floor elsewhere) for `k` in roughly `[4988, 4997]` —
i.e. near `k ≈ mu1`, the large-parameter near-diagonal regime. The issue's own initial
hypothesis (that `marcum-q.js`'s `_transitionBand` was responsible) was wrong; the actual call
path for this parameter range (`marcumQ(k+1, mu2, mu1)` with `mu2 < 30`) never reaches
`_transitionBand` at all — it always routes through `_series` → a single `gammaUpperIncomplete`
call, so the entire defect lived in `src/special/gamma-incomplete.js`'s `_gui`.

## Root Cause

Two independent, additive bugs in `_gui` (the upper-incomplete-gamma continued fraction), only
fully diagnosed by fixing one and re-measuring:

1. `_gui` used a fixed `MAX_ITER = 100` with no regime-aware extension (unlike its sibling
   `_gli`, which already had one). Near `s ≈ x ≈ 5000` the continued fraction needs ~150-160
   iterations and was silently truncated at 99.
2. Even after raising the iteration budget, `_gli`/`_gui`'s shared prefactor line
   `f * Math.exp(-x + s*Math.log(x) - logGamma(s))` summed three individually O(s)-magnitude
   terms (`-x`, `s*log(x)`, `-logGamma(s)`) that cancel to an O(1) result; representing each
   O(4e4)-magnitude term already costs ~1e-11 to 1e-12 of absolute precision in the exponent —
   a floor neither iteration-count fixes nor compensated summation of the pre-formed terms could
   beat.

A third, entirely separate latent bug was discovered mid-implementation while deriving the new
iteration formula: `_gui` also needs up to ~99 iterations at the `x = s+1` boundary for `s` near
**zero** (the opposite end of the parameter space from the reported symptom), previously
silently wrong and only surfaced once the new throw-on-non-convergence guard was added and a
`Tweedie.test()` Anderson-Darling assertion started failing live.

## Fix

Reformulated the shared `_gli`/`_gui` prefactor using Loader's (2000) saddle-point
decomposition — `f * Math.sqrt(s/(2π)) * Math.exp(-bd0(s,x) - stirlerr(s))` — extracted into a
new shared module `src/special/_deviance.js` (`log1pmx`, relocated verbatim from
`marcum-q.js`'s private `_log1pmx`; `stirlerr`, Stirling's series remainder; `bd0`, the
binomial-deviance term). This eliminates the O(s)-magnitude cancellation entirely, replacing it
with an O(1) computation. `_gui`'s iteration cap was raised to
`Math.max(200, Math.ceil(sqrt(2*(s+1)*log(1/EPS))))` (reusing `_gli`'s existing formula shape
but with the floor doubled from 100 to 200, to also cover the newly-discovered small-`s`
boundary case) plus a throw-on-non-convergence guard (`_assertGuiConverged`), mirroring `_fc`'s
`_assertFcConverged` from issue #1286 / ADR-0049.

A naive first attempt at `bd0` (routing every `t = x/s` through `log1pmx(t-1)` unconditionally)
caused a regression: for `x` many orders of magnitude smaller than `s` (e.g.
`gammaLowerIncompleteInv`'s Halley iteration probing `x ~ 1e-30` at `s=1`), `t-1` rounds to
exactly `-1.0` in double precision, losing `t`'s contribution entirely and making
`log1pmx(-1) = -Infinity`. This was caught by 3 existing `gammaLowerIncompleteInv` round-trip
tests. The fix gates `bd0` to only route `t ∈ [0.5, 2]` through `log1pmx`; outside that range
the direct `x - s - s*log(t)` formula has no cancellation (verified via Sterbenz's lemma).

Full end-to-end validation against fresh mpmath (`mp.dps=50`) references (done during planning,
before writing any implementation code) brought the Skellam repro's relative error from
~5e-10–6e-9 down to ~2e-16–2e-15.

## Prevention Strategy

1. A shared `MAX_ITER` constant is only safe for an iterative primitive whose convergence depth
   is bounded independent of its inputs — this is the exact prevention statement already on
   file from `solutions/special-functions/2026-08-02-1200-marcum-fc-slow-convergence.md`
   (#1286), and this occurrence is a direct, expected reapplication of it to `_gui`'s sibling
   `_gli`-style pattern for the large-`s` regime.
2. New here (not covered by the #1286 precedent): when deriving a regime-aware iteration budget
   by sweeping one end of a primitive's parameter space, explicitly sweep the *opposite* extreme
   too — a formula tuned against the large-`s` slow-convergence case (`sqrt(s)`-scaling) can
   silently underestimate at `s → 0`, where `sqrt(s)` vanishes but the primitive still needs a
   large fixed number of steps near a boundary like `x = s+1`. A convergence-throw guard is what
   surfaced this second bug live instead of leaving it silently wrong.
3. When reformulating a cancellation-prone prefactor (Loader/`stirlerr`/`bd0`-style), a "route
   everything through the cancellation-safe `log1pmx` path" version is not automatically correct
   at the opposite extreme (ratio far from 1, `t-1` rounding to exactly `-1`) — gate the safe
   path to the neighborhood where it's actually needed and verify the direct formula's safety in
   the complementary region via a concrete numerical argument (Sterbenz's lemma here), not just
   "it looks fine."
4. Extract a helper into a shared `_`-prefixed module (here `_deviance.js`) once two files need
   it, rather than hand-duplicating a subtly-branching numerical algorithm — this repo already
   has the `src/dist/_gamma.js`/`_beta.js` precedent for this.
5. A "root cause" named in an issue's title/body is a hypothesis, not a fact — tracing the
   actual call path (here: which dispatch branch of `marcumQ` a given parameterization
   exercises) before touching code caught that `_transitionBand` was never involved, redirecting
   the entire investigation to the correct file.

## Related Solutions

- [`solutions/special-functions/2026-08-02-1200-marcum-fc-slow-convergence.md`](2026-08-02-1200-marcum-fc-slow-convergence.md) — the direct sibling for the iteration-budget half of this fix (`_fc`, a different continued fraction in `marcum-q.js`, fixed for the same "fixed `MAX_ITER` truncates a slow convergence" failure mode). Does not cover the prefactor cancellation, the Loader/`bd0`/`stirlerr` reformulation, the `bd0` small-`t` edge case, or the small-`s` boundary non-convergence bug — all new to this fix.
- [`solutions/distribution/2026-08-06-1520-skellam-pdf-log-space-cancellation-fix.md`](../distribution/2026-08-06-1520-skellam-pdf-log-space-cancellation-fix.md) — a related but distinct Skellam precision issue (pdf's own log-space term assembly, #1321), explicitly named as out of scope for and unrelated to this cdf-specific fix.
- [`decisions/0049-continued-fraction-convergence-throw.md`](../../decisions/0049-continued-fraction-convergence-throw.md) — the standing convention `_gui`'s new `_assertGuiConverged` throw guard follows; no new ADR was needed.

## Key Insight

`_gui`'s large-magnitude failure required stacking two independent fixes (a regime-aware
iteration budget *and* a cancellation-free Loader/`bd0`/`stirlerr` prefactor) to reach the
target precision — fixing either alone left a residual ~1e-11 to 1e-12 error — and the process
of deriving the iteration-budget formula for the reported large-`s` symptom incidentally exposed
a second, unrelated small-`s` non-convergence bug in the same function, caught only because the
new throw guard turned silent truncation into a loud, live test failure (`Tweedie.test()`).
