---
date: 2026-08-02T12:00Z
category: "special-functions"
problem: "marcumQ's _fc continued fraction silently truncated at MAX_ITER=100, losing up to 8 digits for large marcum arguments"
status: complete
related_issue: "#1286"
tags: [marcum-q, continued-fraction, modified-lentz, convergence, bessel, max-iter, recurrence]
---

# Solution: marcumQ `_fc` continued-fraction slow convergence (#1286)

**Date**: 2026-08-02
**Category**: special-functions
**Related Issue**: #1286

## Problem

`_fc(nu, z)` in `src/special/marcum-q.js` computes the ratio `I_nu(z) / I_{nu-1}(z)` via a
modified-Lentz continued fraction, and seeds `_recurrence`'s three-term backward recurrence
(the transition-band branch for `mu < 135`). Its loop was capped at the shared `MAX_ITER = 100`.
Once `z` grew past roughly 250-300, the continued fraction needed more than 100 steps to
converge; the loop exited on the iteration cap rather than the convergence check, and returned
the unconverged value with no signal. `_recurrence` then amplified that seed error by ~2-3x per
backward step, producing up to 8 lost significant digits in `NoncentralChi2.cdf` at large
arguments (`NoncentralChi2(200, 2000).cdf(2080)` was off by 5.1e-08 relative) and a
six-orders-of-magnitude accuracy discontinuity across the `mu = 135` dispatch boundary (`_largeMu`,
used for `mu >= 135`, never calls `_fc` and was unaffected).

## Root Cause

The number of continued-fraction steps `_fc` needs to converge depends on `z`, not `nu`: an
empirical sweep across `nu` from `~0` up to `134` and `z` from `50` to `100000` shows the
iteration count needed for `|delta - 1| <= Number.EPSILON` follows

```
m(nu, z) ≈ K(nu) * sqrt(z),   K(nu) ∈ [~4.8, ~6.4], K decreasing as nu increases
```

with `K -> ~6.2` as `nu -> 0` (the slowest case) and `K` only mildly smaller (~4.8) at `nu = 134`
(the largest order `_recurrence` ever passes, since `_transitionBand` routes `mu >= 135` to
`_largeMu` instead). `MAX_ITER = 100` alone only covers `z` up to roughly `(100/6.4)^2 ≈ 250`;
beyond that, `_fc` returns early with `m == MAX_ITER` and `|delta - 1| > EPS` still true, silently
handing `_recurrence` an under-converged seed.

Confirmed against the issue's own reproduction: `_fc(105, 2038.07)` needs 189 iterations
(measured with the library's actual `EPS = Number.EPSILON` and `DELTA = 1e-30`); the 100-iteration
cap left it 89 iterations short, which is what drove the reported 4.79e-07 relative error in that
seed value.

## Fix

`_fc` now computes a regime-aware local iteration budget instead of relying on the shared
`MAX_ITER`:

```js
const maxIter = Math.max(MAX_ITER, Math.ceil(7 * Math.sqrt(z)) + 20)
```

`K = 7` sits comfortably above the measured worst-case `K ≈ 6.36` (at `nu` near 0), and the
`+ 20` additive margin covers the small-`z` end of the curve where the `sqrt` term alone
undershoots by a few iterations. A stress test across `nu` in `(0, 135)` and `z` up to `1e5`
found zero non-convergent cases with this budget, worst-case spare margin 17 iterations.

If the budget is ever insufficient, `_fc` now throws rather than silently returning the
unconverged value:

```js
if (Math.abs(delta - 1) > EPS) {
  throw Error(`_fc: continued fraction failed to converge for nu=${nu}, z=${z} after ${maxIter} iterations`)
}
```

This follows the same "throw on an iterative primitive exceeding its budget" convention already
used by `src/algorithms/rejection.js`. No caller currently needs to catch this — the regime-aware
budget is derived to cover `_fc`'s entire real usage domain — but a future extreme case now fails
loudly instead of quietly losing precision.

**Residual note**: fixing `_fc` does not make `_recurrence`'s output exact. The backward
recurrence still amplifies `_pqTrap`'s own seed rounding by ~2-3x per step (the same floor
`NONCENTRAL_CHI2_XVALS`'s `[268, 64]` group already documents at ~1e-13). At the issue's own
reproduction point, `_fc`'s fix alone brings `NoncentralChi2(200, 2000).cdf(2080)` from
5.1e-08 relative error down to ~1.5e-12 — a ~34000x improvement, and identical to what an
effectively-uncapped `_fc` (tested at `maxIter = 100000`) produces, confirming the residual
is `_recurrence`'s own seed/amplification floor, not further `_fc` truncation.

## Prevention Strategy

1. **A continued fraction's convergence depth is a function of its argument, not a constant.**
   `_erfcLaplaceCF` (`src/special/error.js`) and `_gli`'s Taylor series
   (`src/special/gamma-incomplete.js`) hit the same class of bug before this — a shared
   `MAX_ITER = 100` silently truncating once the argument grew past the point that constant was
   tuned for. `_gli` already uses the right pattern (`Math.max(MAX_ITER, Math.ceil(f(s, EPS)))`,
   a regime-aware analytic bound); `_fc` now follows the same shape.

2. **Empirically fit the scaling law before picking a margin.** Deriving `_fc`'s exact
   convergence-depth formula from Perron continued-fraction theory was out of scope for this fix;
   sweeping the actual loop across a wide `(nu, z)` grid and fitting `m ≈ K*sqrt(z)` took minutes
   and gave a verifiable, stress-tested bound. Always add margin (here `K = 7` vs. measured
   `~6.36`) rather than gating on the measured worst case exactly.

3. **A "fixed the primitive" precision-gate set can still be blocked by an unrelated bug in the
   same code path.** The natural regression-test parameters for this fix (mirroring the issue's
   own `NoncentralChi2(200, 2000)` reproduction) hit a *separate*, already out-of-scope defect:
   `NoncentralChi2._pdf` overflows to `Infinity`/`NaN` once `besselI`'s argument
   `sqrt(lambda*x)` exceeds ~715-720, and at `mu = 100` every marcum-x large enough to exercise
   `_fc`'s old bug also crosses that overflow floor. The precision-gate set added here
   (`NoncentralChi2[76, 692]`) instead uses the smallest `mu` for which marcumQ's own dispatch
   (`mu^2 >= 2*xi`) still routes through the recurrence branch at `xi` near that overflow ceiling
   — maximizing the exercised `_fc` depth (125-131 iterations) while keeping `pdf` finite at
   every probed point.

## Related Solutions

- [`solutions/special-functions/2026-06-05-0000-inverse-gaussian-cdf-erfc-cancellation-cf-convergence.md`](2026-06-05-0000-inverse-gaussian-cdf-erfc-cancellation-cf-convergence.md) — the same class of bug (`_erfcLaplaceCF` under `MAX_ITER = 100`), fixed with a fixed, hand-measured local cap (250) rather than a regime-aware formula, because that CF's real usage domain (`x >= 1`, bounded) made a single constant sufficient. `_fc`'s usage domain (`z` unbounded by any distribution-level parameter constraint) needed the regime-aware form instead.
- [`solutions/special-functions/2026-05-21-1604-marcum-large-mu-asymptotic.md`](2026-05-21-1604-marcum-large-mu-asymptotic.md) — why `_largeMu` (the `mu >= 135` branch) never calls `_fc` and was therefore unaffected by this bug, which is what produced the accuracy discontinuity across the `mu = 135` dispatch boundary this issue reports.

## Key Insight

A shared `MAX_ITER` constant is only safe for an iterative primitive whose convergence depth is
either bounded independent of its inputs, or explicitly re-derived per call site. `_fc`'s depth
scales with `sqrt(z)` and `z` is not bounded by anything in `NoncentralChi2`/`NoncentralChi`'s
public parameter space, so no single constant — however large — is actually safe; only a
regime-aware budget (derived and stress-tested against the primitive's real behavior) is.
