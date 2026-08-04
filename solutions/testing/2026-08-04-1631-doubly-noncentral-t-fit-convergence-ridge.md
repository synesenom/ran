---
date: 2026-08-04T16:31:53Z
category: "testing"
problem: "Whether DoublyNoncentralT.fit()'s measured bounded-vs-unbounded lnL gap reflects a genuine (nu, theta) identifiability ridge or a Powell convergence-tolerance robustness gap"
status: complete
related_issue: "#1336"
tags: [doubly-noncentral-t, fit, powell, likelihood-ridge, unidentifiability, convergence-tolerance, profiling]
---

# Solution: DoublyNoncentralT.fit() convergence quality on its nu/theta ridge

**Date**: 2026-08-04T16:31:53Z
**Category**: testing
**Related Issue**: #1336

## Problem

`test/dist-base-fit-3.js` (the `DoublyNoncentralT.fit should not show intolerable quality loss...`
test) measured bounded-vs-unbounded lnL gaps on `new dist.DoublyNoncentralT(5, 1, 2).seed(seed).sample(300)`
data across four seeds: seed 1 → 0.325, seed 7 → 0.0047, seed 42 → 0.473, seed 99 → 0.609 (lnL
magnitude ~-400 to -450 for this data). The test tolerance was set to 2, with a tentative
attribution to a nu/theta identifiability ridge similar to `DoublyNoncentralBeta`/`DoublyNoncentralF`'s
ridge (see Related Solutions), but appearing here on correctly-specified, well-matched data (unlike
those two, whose documented ridge only appears on family-mismatched data). Issue #1336 asked whether
this gap reflects a genuine identifiability weakness in the (nu, mu, theta) parameterization on
finite samples, or a `fit()`-robustness gap where the optimization approach could be improved.

## Root Cause

Both mechanisms are real, but they are **largely independent of each other**, not two competing
explanations for the same numbers.

1. **A genuine (nu, theta) identifiability ridge exists**, confirmed by profile-likelihood sweeps
   (fixing nu at each of a range of integers, jointly re-optimizing mu/theta at full `tol=1e-10,
   maxIter=200` Powell precision for each). On well-matched, correctly-specified data, the profile
   log-likelihood as a function of nu is markedly flatter than a well-identified single parameter
   would produce — for three of the four seeds tested, multiple nu values spanning a wide range
   (e.g. nu=6 through nu=20+ for seed 42; nu=9 through nu=50 for seed 7, extending into the theta=0
   boundary) sit within ~0.1-1.5 lnL units of the profile maximum. This is a real, structural
   property of the (nu, mu, theta) parameterization: increasing nu is compensated by increasing
   theta (and a small decrease in mu) to preserve almost the same fitted shape. It is
   **sample-dependent**, not a fixed structural degeneracy: seed 99's profile likelihood is sharply
   peaked at nu≈5 with no ridge at all (monotonically worsening for nu > 7), while seed 7's is
   almost perfectly flat from nu=9 to nu=50.

2. **The ridge does not explain the measured bounded-vs-unbounded gap sizes.** The seed with the
   flattest, widest ridge (seed 7) has the *smallest* measured gap (0.0047), and the seed with no
   ridge at all (seed 99, sharply peaked) has the *largest* gap (0.609) — the opposite of what "the
   gap is caused by the ridge" would predict. A flat ridge means any two points along it have
   similar lnL almost by definition, so under-converging onto a slightly different point along the
   ridge costs little; landing off-optimum on a sharply peaked likelihood (seed 99) costs much more,
   because there is no flat region to land in.

3. **The actual driver of the measured gap is Powell's fractional convergence tolerance interacting
   with sample size.** `_powellOptions()`'s bounded budget (`tol=1e-2, maxIter=15`, calibrated in
   the `#1332` regression fix) uses a *relative* convergence test (`powell.js:281`,
   `2*|fStart-fret| <= tol*(|fStart|+|fret|)`) against an objective (negative log-likelihood) whose
   magnitude scales roughly linearly with `n`. A fixed *fractional* tolerance therefore permits a
   progressively larger *absolute* lnL gap as `n` grows. Confirmed directly: repeating the
   bounded-vs-unbounded comparison at n=100, 1000, and 3000 (vs. the test's n=300) shows the gap
   growing with sample size rather than shrinking:

   | n | seed | bounded lnL | relaxed lnL | gap |
   |---|---|---|---|---|
   | 100 | 1 | -128.2419043 | -128.2418999 | 0.0000044 |
   | 100 | 42 | -148.8282 | -148.7085 | 0.1197 |
   | 1000 | 1 | -1475.7012 | -1474.3388 | 1.3624 |
   | 1000 | 42 | -1481.8068 | -1480.3952 | 1.4116 |
   | 3000 | 42 | -4482.7352 | -4479.6522 | 3.0830 |

   At n=1000-3000 the gap already exceeds the entire n=300 seed range (0.005-0.61) documented in the
   issue, and by a wide margin at n=3000 — the clean, mechanistic signature of a fractional-tolerance
   stopping rule on an n-scaling objective, not of a fixed identifiability ceiling that data volume
   should erode.

Comparison to `NoncentralT` (`src/dist/noncentral-t.js:327-329`, `tol=1e-3, maxIter=15`): its own
analogous test measures a near-bit-identical bounded-vs-unbounded gap (~2.5e-11). `NoncentralT` has
only 2 free parameters (nu, mu) — no `theta` — so there is no third parameter for the optimizer to
trade nu against, and no ridge for a marginally-converged point to hide in. This is consistent with
the ridge (from `theta`) being what makes the ordinary convergence slack *visible* as an lnL
difference at all, even though the ridge's local flatness and the gap's magnitude are not directly
proportional (finding 2 above).

## Outcome

This was a documentation-only investigation — no production code changed. Conclusion: identifiability
weakness in (nu, theta) is real and worth documenting, but the `test/dist-base-fit-3.js` gap the
issue's acceptance criteria centered on is primarily a `fit()` convergence-tolerance artifact, not a
consequence of the ridge. Changing `_powellOptions()`/`_fitInit` was explicitly out of this
investigation's scope — any change risks re-opening the #1332 performance regression it was
calibrated against, since #1332's fix reduced a ~68s pathological fit to ~18s specifically via this
same bounded budget.

The test's explanatory comment (`test/dist-base-fit-3.js`, the
`DoublyNoncentralT.fit should not show intolerable quality loss...` test) was updated to state both
facts precisely — the ridge exists AND is not the gap's cause — rather than the simplified "there's a
ridge, that's why" explanation the original comment tentatively guessed at. The existing tolerance
(2) was left unchanged: it already comfortably covers the measured n=300 gap range (0.005-0.61)
while remaining tight enough to catch a real regression.

Two follow-up issues were filed rather than expanding this investigation's scope further:

- **#1338** — investigate an `n`-aware (or absolute-floor) convergence criterion for
  `_powellOptions()`-bounded fits. The fractional-tolerance-vs-n-scaling mechanism identified here is
  general to every distribution with a bounded `_powellOptions()` override (`NoncentralT`,
  `DoublyNoncentralBeta`, `DoublyNoncentralF`, `DoublyNoncentralT`), not specific to
  `DoublyNoncentralT` — scoped broadly rather than as a single-distribution fix.
- **#1339** — investigate theta=0 boundary convergence behavior for seed 7, whose profile-likelihood
  ridge runs into the `theta >= 0` boundary (theta decreases monotonically to exactly 0 by nu=30).

## Prevention Strategy

When a test's comment attributes an optimizer-quality gap to "an identifiability ridge", verify the
attribution with a profile-likelihood sweep and a gap-vs-ridge-shape cross-check before trusting it —
a ridge can be real and simultaneously not be the cause of the specific numbers a test measures. Rank
the seeds/cases by both the ridge's flatness and the measured gap independently; if the rankings are
inverted (flattest ridge → smallest gap, sharpest peak → largest gap), the ridge and the gap are
separate phenomena and the real driver is elsewhere — here, an unrelated fractional convergence
tolerance that happens to interact with sample size. Confirm a tolerance-mechanism hypothesis by
varying the one parameter the mechanism predicts should matter (sample size `n`) and checking the
gap scales in the predicted direction, rather than resting on the same fixed `n` the original
observation used.

## Related Solutions

- `solutions/performance/2026-07-22-0702-doubly-noncentral-fit-powell-ridge-cost.md` — the prior
  `DoublyNoncentralBeta`/`DoublyNoncentralF` ridge investigation (family-**mismatched**-data-only
  ridge, and the origin of the `tol=1e-2, maxIter=15` bounded `_powellOptions()` pattern this
  investigation's finding 3 depends on); contrasts with this issue's well-matched-data ridge.

## Key Insight

A profile-likelihood ridge and a measured optimizer-quality gap can both be real without one causing
the other — check the correlation between ridge shape and gap size across cases before attributing a
convergence gap to identifiability, since a fractional convergence tolerance interacting with an
objective that scales with sample size can produce the same symptom (a bounded-vs-unbounded lnL
difference) through a completely unrelated mechanism, and the two are only distinguishable by varying
`n` and checking which direction the gap moves.
