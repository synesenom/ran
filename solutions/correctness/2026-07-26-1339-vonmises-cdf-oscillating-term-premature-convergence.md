---
date: 2026-07-26T13:39:06Z
category: "correctness"
problem: "VonMises(kappa).cdf(x) returns out-of-[0,1] values for concentrated kappa near x = k*pi/4"
status: complete
related_issue: "1143 (discovered as a side effect of its boundary-grid work)"
related_plan: "thoughts/plans/2026-07-26-1120-precision-test-bessel-boundary-grid.md"
tags: [von-mises, recursive-sum, fourier-series, convergence-check, oscillating-term, besselI, boundary-testing]
---

# Solution: VonMises `_cdf` premature Fourier-series truncation at x = k·π/4

**Date**: 2026-07-26
**Category**: correctness
**Related Issue**: #1143 (surfaced incidentally while calibrating boundary-adjacent precision-gate parameter sets for `besselI(0,kappa)`'s dispatch threshold)

## Problem

`VonMises(kappa).cdf(x)` returned values outside `[0, 1]` for `kappa` roughly `>= 6-9` at `x = k·π/4` — e.g. `VonMises(9).cdf(-π/4) = -0.0074`. This was not a cosmetic precision loss: it corrupted the general-purpose Chandrupatla quantile root-finder (`Distribution.prototype._qEstimateRoot`) for essentially arbitrary target probabilities in that regime. Concretely, `new VonMises(9).q(new VonMises(9).cdf(-1))` returned `-0.7853981633974476` (exactly `-π/4`) instead of the correct `-1` — an error of ~0.2 radians, far beyond anything a precision-tolerance explanation could cover.

The bug was invisible to the existing precision-gate suite: every prior `VonMises` parameter set (`kappa = 0.5, 1, 2`) used arbitrary interior probe points, none of which happened to land near `kappa >= 6` combined with `x = k·π/4`. It was found only because issue #1143's boundary-grid work deliberately calibrated a `VonMises` parameter set so `kappa` straddled `besselI(0,·)`'s Taylor/backward-recurrence dispatch threshold at `x = 10` — an unrelated goal that happened to push `kappa` into the affected range for the first time.

## Root Cause

`_cdf(x)` computes the CDF via the Fourier series `F(x) = 1/2 + x/(2π) + (1/π) · Σ_{i=1}^∞ I_i(κ)/I_0(κ) · sin(ix)/i`, previously implemented with the shared `recursiveSum` helper (`src/algorithms/recursive-sum.js`), whose convergence check operated on the **raw** term `besselI(i, kappa) * sin(i*x) / i`.

At `x = k·π/4` for integer `k`, `sin(4x)` (and `sin(8x)`, `sin(12x)`, …) coincidentally rounds to machine epsilon **regardless of `kappa`** — a floating-point artifact of `Math.sin` evaluated near an exact multiple of `π`, not a property of the series itself. For `kappa >= ~6-9`, the ratio `besselI(i,kappa)/besselI0Kappa` has not actually decayed by `i=4` (larger `kappa` means the Bessel-ratio envelope decays more slowly with `i`), so the raw term is small purely because its oscillating factor happens to vanish at that exact phase — not because the series has converged. The convergence check mistook this coincidental zero-crossing for convergence and terminated the sum ~10+ orders of magnitude too early, leaving `sum` truncated far short of its true value.

This is a distinct failure mode from the previously-documented `recursiveSum` hazard (`solutions/correctness/2026-07-23-1108-doubly-noncentral-beta-recursivesum-absolute-floor-truncation.md`), where the bug was an *absolute floor* (`EPS * max(|sum|, 1)`) firing prematurely when a series' true converged value sits far below that floor. Here the series' true value is not small at all — the bug is that the checked *term itself* is an unreliable proxy for how much the series has left to contribute, because it carries an oscillating factor that can vanish independently of the envelope that actually bounds the remaining tail.

## Fix

Replaced the `recursiveSum` call in `src/dist/von-mises.js`'s `_cdf` with a direct `for` loop whose convergence check operates on the **non-oscillating envelope** `besselI(i, kappa) / (besselI0Kappa * i)` instead of the raw signed term. This is mathematically sound because `|sin(i*x)| <= 1` always bounds the true term below the envelope: checking the envelope can never be fooled by an incidental zero of the oscillating factor, and — since the envelope is always `>=` the magnitude of the true term — it never terminates *later* than correctness requires either.

## Prevention Strategy

Any convergence/truncation check on a series whose term contains an oscillating factor (`sin`, `cos`, alternating sign, etc.) must check the term's **non-oscillating envelope/magnitude bound**, never the raw signed term itself. The raw term can spuriously round to (near-)zero at specific evaluation points that are artifacts of the oscillating factor's phase, entirely independent of whether the underlying series has converged. This is a generic hazard whenever a shared summation helper (`recursiveSum`, and by extension `accelerated-sum.js`/`neumaier.js` if ever applied to a Fourier-type series) is reused for a series of this shape — audit whether "small term ⇒ converged" holds for the term *as computed*, or whether an envelope needs to be checked instead, before wiring a new caller into `recursiveSum`.

Separately, and more generally: boundary-adjacent parameter grids (deliberately calibrating a distribution's parameters so a probe lands exactly at a special function's internal dispatch threshold, per issue #1143's methodology) are disproportionately effective at surfacing this class of bug compared to arbitrary interior-point test parameters — neither this bug nor the `_zetaxy` marcumQ cancellation bug found earlier in #1143's work would have been caught by the precision-gate's pre-existing coverage. The established "attempted and abandoned" convention (omit the triggering parameter set, document why in a comment, file the bug separately rather than loosening a tolerance to hide it) is what let this bug be examined and fixed rather than silently masked.

## Related Solutions

- `solutions/correctness/2026-07-23-1108-doubly-noncentral-beta-recursivesum-absolute-floor-truncation.md` — a different flavor of the same class of hazard: `recursiveSum`'s generic convergence check firing prematurely for a caller whose series behavior doesn't match the helper's built-in assumptions. That case was an absolute-floor mismatch; this case is an oscillating-term mismatch.
- `solutions/testing/2026-07-24-1141-precision-refs-self-check-never-ran.md` — a reminder that this codebase's precision-gate/self-check safety nets have a track record of silently providing zero protection until someone deliberately probes an untested region; this bug is another instance of "the safety net looked complete but had a gap nobody had walked into yet."

## Key Insight

When a series-summation convergence check is applied to a term containing an oscillating factor, check the term's non-oscillating envelope bound, not the raw term — the raw term can spuriously round to zero at specific evaluation points regardless of true series convergence, and this class of bug is best found by deliberately calibrating test parameters to land at a special function's internal dispatch threshold rather than by arbitrary interior-point testing.
