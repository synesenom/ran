---
date: 2026-07-23T17:07:21Z
category: "correctness"
problem: "DoublyNoncentralBeta pdf/cdf silently returned exactly 0 (not just imprecise) for lambda1+lambda2 >= ~8000 combined with x far from 0.5; the GitHub issue's own diagnosis of a different, smaller-lambda case was itself based on a wrong reference value"
status: complete
related_issue: "#1102"
related_plan: "thoughts/plans/2026-07-23-1519-doubly-noncentral-beta-tail-accuracy.md"
tags: [doubly-noncentral-beta, series-truncation, convergence-check, relocated-walk, peak-locator, incomplete-beta-recurrence, fit-cost-guard, mpmath-reference-bug, false-issue-premise]
---

# Solution: DoublyNoncentralBeta relocated-walk fallback — and the issue's own premise was wrong

**Date**: 2026-07-23T17:07:21Z
**Category**: correctness
**Related Issue**: #1102

## Problem

`DoublyNoncentralBeta.pdf()`/`.cdf()` (and `DoublyNoncentralF`, which delegates to it) silently
returned exactly `0` — not merely imprecise, flat-wrong — for parameter combinations already
within the class's advertised and tested range (`lambda1+lambda2 >= ~8000` combined with `x` far
enough from 0.5). The existing regression suite (`assertFinitePdfCdf` in
`test/dist-base-special-cases.js`, exercising lambda up to 50000) never caught this because it
only asserted finiteness/sign/monotonicity, all of which a flat `0` trivially satisfies.

Separately — and this is the more surprising finding — the GitHub issue that triggered this
investigation was itself built on a false premise. It cited
`DoublyNoncentralBeta(2,2,1200,1200).pdf(0.1)` as "~1750x off" from a supposed true mpmath value
of `3.25e-107`. That reference value was wrong; the JS-computed value it accused of being wrong
(`5.7e-104`) was in fact correct, confirmed independently against a non-adaptive, wide-fixed-range
brute-force mpmath sum.

## Root Cause

Two distinct, layered root causes:

**1. The real bug (fixed here).** The outer Poisson-mixing sum walks index `r` forward/backward
from the Poisson mean `r0 = round(lambda1/2)` within a fixed `MAX_SERIES_ITER = 500`-step window
per direction. At large `lambda`, the true summand peak can sit thousands of steps away from `r0`
(e.g. `lambda1=8000`, `x=0.1`: peak at `r*≈1481` vs `r0=4000`, a shift ~5x the window's reach). The
fixed window never reaches the peak, every visited term underflows or is negligible, and the loop
exits having accumulated exactly `0` — with no signal that convergence was never actually reached.

**2. The issue's false premise (not fixed here — filed separately as #1108).**
`scripts/precision-refs-continuous.py`'s `dncbeta_pdf`/`dncbeta_cdf` reference generators use the
raw Poisson-weight *product* (excluding the Beta-density factor) as a proxy for "this inner term
is now negligible," to decide when to stop the inner `si`-loop. For an outer index `r` far from
its own Poisson mean, that raw weight is already tiny regardless of whether the true
density-weighted term has converged, so the proxy fires as a false positive almost immediately —
silently discarding real mass and producing a reference value ~1750x too small. This is the exact
same *hazard class* of bug `#1086` already fixed in the JS `_seriesSum` helper (an absolute/proxy
convergence floor that is a false signal whenever the true sum is far below what the floor
assumes) — it just recurred independently in the Python reference-generator script instead of in
`src/`.

## Fix

In `src/dist/doubly-noncentral-beta.js`, after several design iterations that were empirically
falsified before landing on the shipped version:

- **Trigger condition**: an *estimated* peak-shift threshold (`|rStar - r0| > MAX_SERIES_ITER`)
  was tried first and rejected — it misrouted cases the standard window already handled correctly
  (verified: `lambda=8000, x=0.6/0.7`'s pdf-symmetry test failed under this design, because the
  estimated threshold fired even though the standard walk's actual convergence was already correct
  to ~12 significant figures). The shipped trigger instead compares each direction's
  (forward/backward) *actual last-added term* against the walk's own final combined total, using a
  deliberately loose `RELOCATE_TOL = 1e-9` — not machine epsilon `EPS` — because an
  already-converged sum's last term can sit a few ULP above `EPS*total` purely from ordinary
  accumulated rounding, which was initially (and incorrectly) treated as genuine non-convergence.

- **Relocation center**: when relocation is genuinely needed, *both* the pdf and cdf fallback reuse
  the same `_peakIndex` closed-form density-peak formula (derived by setting a consecutive-term
  ratio to 1). This was not obvious. The cdf's summand
  (`Poisson(r)*Poisson(s)*regularizedBetaIncomplete(...)`) is monotonically *decreasing* in `r`,
  not peaked like the pdf's density term — so a cdf-specific "own transition point" formula (where
  `regularizedBetaIncomplete` crosses 0.5) was derived and tried next. It was *also* wrong, for the
  same underlying reason: it ignores where the Poisson weight itself concentrates, landing the walk
  tens of Poisson-sigmas from any real mass (verified: `lambda=8000, x=0.7` produced
  `cdf=1.75e-25` against a true value near 1 — an outright monotonicity violation). The correct
  insight, confirmed against an independent brute-force sum, is that the real bottleneck for
  *both* pdf and cdf is reaching wherever the Poisson weight concentrates — not finding some
  cdf-specific transition point — so the pdf's own peak formula is the right relocation center for
  both summand shapes.

- **Safety net**: the final result is `Math.max(standard, relocated)`. Every term summed in both
  computations is non-negative, so both are valid partial lower bounds on the true value, and
  taking the larger is always safe. This caught and fixed a real case (`lambda=20000, x=0.7`)
  where relocating actually produced a *worse* (smaller, wrong) answer than the already-decent
  standard-path partial sum.

- **Performance**: the relocated fallback's naive per-term implementation (fresh
  `logGamma`/`logBeta`/`regularizedBetaIncomplete` calls per `(r,s)` pair, worst case 500×500 =
  250,000 evaluations) made `DoublyNoncentralF.fit()`'s existing `#1063` timing regression test
  (40s budget) start timing out. An `O(1)`-per-step incremental log-domain recurrence for the
  relocated walk was implemented and succeeded for the pdf side, but produced *wrong* results for
  the cdf side's incomplete-beta recurrence (a sign error in choosing between the two "increasing
  vs. decreasing `b`" incomplete-beta recurrence identities, only caught by cross-checking against
  an independent reference, not resolved within the session) and was reverted for the cdf
  specifically. The shipped compromise caps *both* relocated walks at a smaller, dedicated
  `RELOCATE_MAX_ITER = 150` (vs. the standard path's `MAX_SERIES_ITER = 500`), keeping the `#1063`
  timing test comfortably under budget (~30.6s measured) while still producing
  order-of-magnitude-correct — not machine-precision — results for the extreme cases `#1102`
  targets. This is a documented, deliberate precision-vs-cost trade-off, not an oversight,
  confirmed via a full 8-agent `/review` pass (0 Block findings; the correctness reviewer
  independently confirmed the cdf's remaining extreme-tail monotonicity edge case, at ~1e-147
  scale, is an inherent consequence of this trade-off, not a new defect).

- The Python reference-generator bug that produced the issue's wrong "true value" was **not**
  fixed in this PR — filed separately as `#1108`, since it's a different failure surface
  (`scripts/`, not `src/`) and out of `#1102`'s declared scope.

A merge conflict arose mid-session: `#1103` (an independently-running fix) refactored this same
file's shared `_seriesSum` helper into a parameterized call to the shared `recursiveSum(...,
{useFloor: false})`, colliding with this fix's changes to the same file. Resolved by a manual
merge combining both: `recursiveSum`'s new `useFloor` option (from `#1103`) alongside this fix's
new `lastDz`-tracking return shape and relocated-walk methods.

## Prevention Strategy

1. **Never trust a bug report's own "true value" without independently re-deriving it from
   scratch.** This investigation followed `#1086`'s own prevention strategy ("cross-validate a
   from-scratch, independent implementation before trusting it as ground truth") and found the
   issue's premise itself was false. Any future accuracy bug report against a bounded/windowed
   series-summation function should be verified against an independent, non-adaptive (ideally
   brute-force) reference before treating the reported "true value" as ground truth.
2. **A convergence-check false positive is a recurring hazard class, not a one-off bug.** `#1086`
   fixed it in `_seriesSum` (JS); the identical shape of bug (using a proxy/partial quantity
   instead of the true term magnitude to decide "negligible") reappeared independently in the
   Python reference generator. Whenever a summation's stopping condition uses anything other than
   the actual term/partial-sum ratio (a factored-out weight, an index-only heuristic, an absolute
   floor), audit it explicitly for this failure mode — it silently truncates real mass specifically
   in the tail/off-peak regime, exactly where bug reports about "wrong tail values" originate.
3. **Regression tests that only check finiteness/sign/monotonicity do not catch "silently exactly
   0."** A flat wrong answer that happens to be finite and correctly signed sails through weak
   assertions. Any bounded/windowed numerical algorithm needs at least one regression case near its
   documented boundary that asserts an actual, externally-sourced numeric value, not just shape
   properties.
4. **A relocation-center formula derived for one summand shape does not automatically transfer to
   a structurally different one sharing the same mixing index.** The pdf's density-peaked summand
   and the cdf's monotonic-in-r summand needed the same underlying fix (walk to where the Poisson
   weight concentrates) but two intuitive, formula-level "cdf-specific" approaches were both wrong
   before landing on reusing the pdf's own peak formula — verify a proposed center against an
   independent computation for *each* summand shape it will be applied to, don't assume transfer.
5. **Trigger relocation/fallback logic on observed failure, not an estimated threshold.** An
   estimated-shift threshold reliably misrouted cases the standard path already handled correctly;
   checking the standard path's own actual convergence signal (with a loosened, not
   machine-epsilon, tolerance to avoid ULP-noise false positives) was the design that held up.
6. **Expect and budget for merge conflicts when CLAUDE.md's cross-cutting decomposition guidance
   routes multiple concurrent issues at the same shared file** (here, `#1103`'s helper refactor and
   `#1102`'s fix both touching `doubly-noncentral-beta.js`) — resolve by combining both sides'
   intent, not by discarding either.

## Related Solutions

- `solutions/correctness/2026-07-23-1108-doubly-noncentral-beta-recursivesum-absolute-floor-truncation.md`
  — the `#1086` fix this issue is a residual of; same hazard class (absolute/proxy convergence
  floor) recurring in a different location (the Python reference generator, not `_seriesSum`).
- `solutions/performance/2026-07-22-0702-doubly-noncentral-fit-powell-ridge-cost.md` and
  `decisions/0016-distribution-fit-powell-and-exact-mle.md` — the `#1063` cost guard this fix's
  `RELOCATE_MAX_ITER` cap was specifically tuned to stay within.
- `solutions/special-functions/2026-06-01-1330-bessel-i-miller-normalization-max-iter-truncation.md`
  — an earlier instance of the same "fixed cap below where the series peak actually falls" bug
  class, fixed there via an in-sweep closed-form identity (not available here).

## Key Insight

A bounded forward/backward series-summation walk centered on a distribution's Poisson mean
silently truncates to a wrong — sometimes exactly zero — answer once the true summand peak drifts
outside the fixed window as noncentrality parameters grow; the correct relocation center for such
a walk must be derived per summand shape (peaked vs. monotonic), verified against an independent
brute-force computation, and triggered only by observed non-convergence with a loosened tolerance
rather than a pre-estimated shift threshold, since estimated thresholds reliably misroute cases the
standard window already handles correctly — and a bug report's own cited "true value" is not
exempt from this same independent-verification discipline.
