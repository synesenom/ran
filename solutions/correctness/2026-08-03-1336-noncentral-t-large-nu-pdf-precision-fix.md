---
date: 2026-08-03T13:36:08Z
category: "correctness"
problem: "NoncentralT.pdf() silently loses ~8 significant digits at large nu because its saturation gate's threshold doesn't scale with nu"
status: complete
related_issue: "1325"
related_plan: "thoughts/plans/2026-08-03-0930-noncentral-t-large-nu-pdf-precision-fix.md"
tags: [noncentral-t, catastrophic-cancellation, saturation-gate, nu-scaled-threshold, powell-options, fit-performance, precision]
---

# Solution: nu-scaled saturation-gate threshold for NoncentralT._pdf, plus a bounded Powell search budget to keep NoncentralT.fit() affordable

**Date**: 2026-08-03T13:36:08Z
**Category**: correctness
**Related Issue**: #1325

## Problem

`NoncentralT._pdf(x)`'s fast CDF-differencing path (`Math.max(0, nu * (a - b) / x)`, where `a`/`b`
come from two `NoncentralT.fnm` calls) silently lost catastrophic precision at large `nu` (~10000+),
with no error, exception, or `NaN` to signal it: `NoncentralT(10000, 0).pdf(0.5)` returned
`0.3520526413036684` against a true `0.35205267468981716`, a ~9.5e-8 relative error — nine orders of
magnitude worse than the class's own `_pdfDirect` fallback's ~1e-13 on the identical input. The
pre-existing `nearOppositeBoundary` saturation gate (`nu >= 30 && Math.abs(a - b) < 1e-9`, from
#1250/#1318) never fired for this case, even though `|a - b| = 1.76e-5` was already
amplified-noise-corrupted.

## Root Cause

`fnm`'s own absolute computational noise floor is not fixed — it grows roughly linearly with `nu`
(from `regularizedBetaIncomplete` at large `nu/2` for `mu=0`, or the AS243 recursive sum otherwise).
The fast path then multiplies the raw difference `a - b` by `nu` and divides by `x`. Because `a - b`
itself shrinks as `nu` grows (for fixed `x`, the CDF barely moves between `nu` and `nu+2` once `nu`
is in the thousands), this `nu`-proportional amplification factor turns a noise floor that grows only
mildly with `nu` into a `pdf`-level relative error that grows much faster — from ~1e-13 at `nu=30` to
~1e-7 at `nu=10000` to ~1e-5 at `nu=100000` (measured against `_pdfDirect`/the closed-form central-t
density). The existing gate's `1e-9` threshold was a flat absolute constant, tuned by #1250 for the
moderate-`nu` regime that issue exercised, and never revisited for whether it needed to scale with
`nu` as the amplification factor itself does.

A second, independently discovered problem surfaced only once the threshold was corrected:
`NoncentralT.fit()`'s Powell optimizer, on data that isn't genuinely noncentral-t-shaped (e.g. the
bounded/circular sample `VonMises(0, 2).sample(500)`), has no interior optimum in `nu` — the
log-likelihood keeps improving as `nu` grows without bound, so an *unbounded* search explores `nu`
into the tens of thousands (measured: 425,000 total `pdf()` calls, `nu` up to 24,033, converging to
`nu=18191`). Pre-fix, this cost only 1.5s, because the (numerically wrong) fast path is cheap even
where it's inaccurate. Once the corrected gate routes those large-`nu` evaluations through
`_pdfDirect` (measured ~80x more expensive per call, 0.4ms vs 0.005ms), the same optimizer trajectory
became unaffordable — a pre-existing, unrelated test (`test/guess.js`'s
`'should include VonMises in the default pool for data it fits well'`) went from ~34s to over 150s
without completing.

## Fix

**1. `nearOppositeBoundary`'s threshold now scales with `nu`:** `nu * Number.EPSILON * 1e10`
(replacing the flat `1e-9`), empirically validated across `nu` from 30 to 100000, `mu` from 0 to ±5,
and `x` from 0.01 to 5, cross-checked against the closed-form central-t density (for `mu=0`) and
`_pdfDirect` (for `mu != 0`). It correctly fires for every case with `nu >= 1000` tested (where the
old flat threshold missed the amplified noise) and leaves the already-accurate `nu` in `[30, 300]`
regime #1318 validated untouched — confirmed by a dedicated "gate stays OFF" pin test.

A notable simplification surfaced during validation: the corrected threshold only needs to depend on
`nu`, not `x`. The fast-path candidate value is `p = nu*(a-b)/x`; if `a-b` carries an absolute noise
floor `ε(nu)` independent of `x`, the amplified *absolute* error in `p` is `(nu/x)*ε(nu)`, but the
*relative* error is `(nu/x)*ε(nu) / p ≈ ε(nu) / (a-b)` — the `x` terms cancel algebraically. This was
confirmed empirically: a `nu=10000, x=0.01` case (`|a-b| = 3.99e-7`) and a `nu=10000, x=0.5` case
(`|a-b| = 1.76e-5`) both have `fnm` noise on the same order once normalized by `|a-b|`, and a single
`nu`-only threshold correctly flags both.

**2. `NoncentralT._powellOptions()` bounds the search budget:** `{ tol: 1e-3, maxIter: 15 }`,
mirroring the existing `DoublyNoncentralBeta`/`DoublyNoncentralF` bounded-search pattern from #1063
(the same class of problem: expensive-per-call `pdf`/`pmf` multiplied by an optimizer's unbounded
exploration on data that doesn't genuinely belong to the fitted family). A "shadow evaluation"
analysis — replaying the pathological optimizer's actual recorded `(nu, mu, x)` call trajectory
against several candidate threshold multipliers, without paying `_pdfDirect`'s real cost each time —
proved that **no threshold constant could simultaneously fix the issue's own reported case and keep
the pathological-data trigger rate affordable**: at the multiplier needed to catch `nu=10000`
(`~8e6` minimum), 40-90%+ of the 425,000 pathological-fit calls would trigger the fallback regardless
of exactly how the multiplier was tuned within the range that still fixes the reported bug. The
tension is fundamentally about call-volume × a fixed ~80x per-call cost ratio, not about precisely
where the gate fires — so it could only be resolved by bounding the optimizer, not by further
threshold tuning. `DoublyNoncentralBeta`'s own `tol: 1e-2` was tried first and found to under-recover
`nu` on this file's own `dist-base-fit-2.js` `NoncentralT(5,1)` regression test (`nu=7` instead of
`nu=6`, breaking that test's `<= 1` diff assertion); `tol: 1e-3` was found to reproduce the unbounded
search's converged result to within floating-point noise (bit-identical `nu`, `mu` differing only in
the 6th decimal) while cutting the pathological fit from >150s to ~9s.

**Testing.** 5 hand-written mpmath-referenced precision tests plus a "gate stays OFF" regression pin
were added to `test/precision-noncentral-t-boundary.js` (mirroring that file's existing per-case
style — this file exists specifically because `NoncentralT.fnm`/`_pdfDirect` are `@ignore`d statics
outside the generated precision-gate runner's shape). 2 tests were added to `test/dist-base-fit-2.js`
for `_powellOptions` (a pathological-data call-count regression guard, and a well-matched-data
quality-preservation check), mirroring the existing `DoublyNoncentralBeta`/`F` test pattern already in
`test/dist-base-fit-1.js`. A parallel 8-agent code review caught 3 further test-quality gaps before
commit: a redundant, fragile "gate ON" pin test that monkeypatched a private static purely to assert
it was called (removed — the adjacent tolerance-based value assertion already fails hard if the gate
misfires, since the pre-fix value is off by six orders of magnitude more than that test's tolerance);
the missing `_powellOptions` coverage (added, as above); and a missing crossover-boundary test for the
threshold formula itself (added — a case at `NoncentralT(340, 0).pdf(1.0)` where `|a-b|` sits at
~94% of the threshold, verified RED against two deliberately-reintroduced formula bugs — a 10x
constant error and a dropped `nu` factor — before being finalized, to prove it actually catches what
it claims to).

**Deferred, filed separately.** `DoublyNoncentralT` has the structurally identical flat-`1e-9` gate
pattern at two sites (`doubly-noncentral-t.js:192,385`), falling back to `NoncentralT.snm` rather than
`_pdfDirect`. Whether the same amplification mechanism (and hence the same `nu`-scaled fix) applies
there is unconfirmed — different fallback function, different call structure (summed over
Poisson-mixture terms, not a single difference) — so it was filed as
[#1332](https://github.com/synesenom/ran/issues/1332) rather than folded into this fix, consistent
with issue #1325's own scope (restricted to `src/dist/noncentral-t.js`/`_pdf`) and this repo's "one
concern per issue" convention.

## Prevention Strategy

**A saturation/precision gate scaled against one parameter needs to be re-examined for whether its
threshold should scale with that parameter too — a flat constant tuned for the regime a specific past
issue happened to exercise silently stops protecting once that parameter moves far enough outside the
tuning regime.** #1250 tuned `1e-9` empirically against its own reported case (`nu` in the low
hundreds); nothing about that number was re-derived when later callers pushed `nu` into the thousands.
Whenever a numeric gate constant is carried forward across unrelated fixes (#1250 → #1298 → #1302 →
#1318 all reused the same `1e-9`), check whether the underlying quantity it's protecting against
scales with any of the call's own parameters before assuming the old constant still generalizes.

**A correctness fix that routes a hot-path call to a materially more expensive fallback must be
checked against `fit()`'s optimizer separately from the direct-call case — this is not automatically
caught by testing the reported bug's own reproduction case.** An unbounded Powell search with no
interior optimum (data that doesn't belong to the fitted family) can amplify a modest per-call cost
increase into a multi-minute hang, and this failure mode is invisible until someone actually runs
`.fit()` on mismatched data with the fix applied — the issue's own acceptance criteria said nothing
about `.fit()` performance, yet a pre-existing, unrelated test caught it. When a fix increases a hot
path's per-call cost, proactively run this repo's existing "does `.fit()`/`guess()` explore this code
path expensively" check (as `test/guess.js`'s own accumulated comments for #1298/#1302/#1318 already
document happening repeatedly for this exact file) rather than waiting for CI to surface it.

**When a per-call cost increase interacts badly with an unbounded optimizer, don't keep retuning the
threshold that caused the cost increase — bound the optimizer instead, using the established
`_powellOptions()` pattern.** A "shadow evaluation" analysis (replay the actual pathological call
trajectory against candidate parameter values cheaply, without paying the real fallback cost each
time) is an efficient way to prove *before* committing to an approach that no amount of threshold
tuning alone can resolve a call-volume-driven performance problem — the tension here was structural
(fixed per-call cost ratio × call count), not something a different constant could paper over.

## Related Solutions

- `solutions/correctness/2026-08-01-2030-noncentral-t-fnm-snm-boundary-saturation.md` (#1250) — origin
  of the `nu >= 30` magnitude-gate convention this fix's `nearOppositeBoundary` scaling preserves
  (only the threshold *value* changed, not the `nu >= 30` guard). **Not superseded**: fixes a
  different saturation mechanism (boundary rounding to exactly 1.0/0), not the threshold-scaling gap
  this fix addresses.
- `solutions/correctness/2026-08-02-2100-noncentral-t-fnm-dual-saturation-mechanism.md` (#1298) and
  `solutions/correctness/2026-08-02-2040-noncentral-t-fnmdiff-saturation-fix.md` (#1318) — prior
  patches to this same gate, fixing the `stuckAtPhi` condition and replacing the CDF-differencing
  fallback with `_pdfDirect`. **Not superseded**: this fix's own root-cause section explicitly checked
  its `nu`-scaled expansion against #1318's own "repeated gate-patching is a smell" prevention lesson
  and found it to be a single well-justified expansion of the existing gate's applicability, not a
  third narrow patch targeting a new, unrelated saturation pattern.
- `solutions/performance/2026-07-22-0702-doubly-noncentral-fit-powell-ridge-cost.md` (#1063) — origin
  of the `_powellOptions()` bounded-search pattern this fix reapplies to `NoncentralT`. **Not
  superseded**: this is a textbook, recalibrated reapplication of that exact pattern to a new class,
  not a correction to it.
- `solutions/performance/2026-07-22-1600-doubly-noncentral-fit-inner-line-search-budget.md` (#1078) —
  confirms `powell.js`'s coupled outer/inner `maxIter` budget is load-bearing on exactly this class of
  ridge-shaped-likelihood data, which this fix's own `_powellOptions()` calibration relies on
  (the coupled budget is what makes a single `{tol, maxIter}` pair effective at bounding both the
  outer search and each inner line search).

## Key Insight

A parameter-scaled noise floor needs a parameter-scaled gate threshold — remarkably independent of
the fast path's *other* variable (`x`) here, because the amplification factor and the candidate value
share the same `x`-dependence and cancel in relative terms — and a correctness fix that routes a hot
path to a more expensive fallback must be checked against `fit()`'s unbounded optimizer separately,
since that failure mode is not fixable by retuning the same threshold, only by bounding the search.
