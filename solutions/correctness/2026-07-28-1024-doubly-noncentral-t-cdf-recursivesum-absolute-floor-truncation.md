---
date: 2026-07-28T10:24:53Z
category: "correctness"
problem: "DoublyNoncentralT(nu, mu, theta).cdf(x) is silently wrong (off by many orders of magnitude, and non-monotonic) once theta gets large"
status: complete
related_issue: "1189 (discovered as a side effect of its f11 boundary-grid work); follows up on the audit named but explicitly out-of-scope in #1103"
tags: [doubly-noncentral-t, recursive-sum, convergence-check, absolute-vs-relative-tolerance, poisson-mixing, precision-gate, boundary-testing]
---

# Solution: DoublyNoncentralT `_cdf` premature truncation for large theta

**Date**: 2026-07-28T10:24:53Z
**Category**: correctness
**Related Issue**: #1189 (surfaced incidentally while calibrating a `DoublyNoncentralT` parameter set so `f11`'s internal `|z|=50` dispatch threshold falls inside the distribution's support)

## Problem

`DoublyNoncentralT(nu, mu, theta).cdf(x)` returns a badly wrong, non-monotonic result once
`theta` is large enough that `exp(-theta/2)` underflows below `Number.EPSILON`. Concretely, for
`DoublyNoncentralT(5, 5, 120)`:

- `cdf(-1)` returned `1`
- `cdf(0)` returned `1.53e-31`

i.e. the CDF *decreased* between `x = -1` and `x = 0`, which is impossible for any valid CDF. An
independent check — sampling 20,000 draws from `_generator()` (a completely separate code path)
— showed the true distribution concentrated tightly around `x ≈ 1` (p1 ≈ 0.52, median ≈ 1.0, p99
≈ 1.58), consistent with an mpmath (`mp.dps=50`) reference `cdf(0) ≈ 2.87e-7`, not `1.53e-31`.

This was invisible to the existing precision-gate suite: every prior `DoublyNoncentralT`
parameter set (`theta = 1, 2`) kept `exp(-theta/2)` comfortably representable, so the bug never
triggered. It was found only because #1189's boundary-grid work deliberately pushed `theta` to
~120 so that `f11`'s `|z|=50` dispatch threshold (`z = theta/(2*(1+x²/nu))`, exercised inside
`_pdf`) would fall inside the calibrated `x` probes — an unrelated goal that happened to be the
first parameter set to push `theta` past the point where this bug activates.

## Root Cause

`_cdf(x)` sums a Poisson(`theta/2`)-weighted mixture of noncentral-t CDFs via the shared
`recursiveSum` helper (`src/algorithms/recursive-sum.js`), seeded with
`p: this.c.expHalfTheta` (`= exp(-theta/2)`). `recursiveSum`'s default convergence check is:

```js
if (Math.abs(delta) < EPS * Math.max(Math.abs(sum), 1)) break
```

The `Math.max(Math.abs(sum), 1)` floor assumes the running sum is around 1 or larger. For
`theta = 120`, the leading term is `exp(-60) ≈ 8.75e-27` — already far below `EPS ≈ 2.22e-16` on
its own — so the very first term satisfies the break condition trivially and `recursiveSum`
declares "convergence" after 1 iteration, nowhere near the ~150+ terms needed to reach the
Poisson(60) weight's actual peak. This is the exact same hazard class already fixed for
`DoublyNoncentralBeta` in #1086 (`solutions/correctness/2026-07-23-1108-doubly-noncentral-beta-recursivesum-absolute-floor-truncation.md`)
and explicitly flagged as an un-audited risk for `DoublyNoncentralT` in that solution's follow-up,
#1103 ("Out of Scope: Auditing other `recursiveSum` callers for the same correctness bug").

## Fix

Passed `{ useFloor: false }` — the opt-out `recursiveSum` gained in #1103 specifically for this
failure mode — to the `_cdf` recursive sum call in `src/dist/doubly-noncentral-t.js`. Safe here
for the same reason it was safe for `DoublyNoncentralBeta`: every term (`Poisson weight *
noncentral-t CDF value`) is non-negative, so the sum only trends toward legitimate cancellation-free
convergence, never toward a false zero-crossing the floor was meant to protect against.

Verified against the mpmath (`mp.dps=50`) reference for `DoublyNoncentralT(5, 5, 120)`: `cdf(0)`
and `cdf(0.3)` now match to the full float64 precision the un-patched code already achieved for
small-theta parameter sets (previously off by 24+ orders of magnitude).

One residual limitation, deliberately left unfixed as out of scope for #1189: for `x < 0`, `_cdf`
computes the result as `1 - z` where `z` is itself computed by this same (now-corrected) sum. When
the true CDF is extremely small (e.g. `x` deep in the left tail relative to `mu`), `z` rounds to
exactly `1` in float64 before the subtraction ever happens, and `1 - z` collapses to `0` (or an
arbitrary noise value near the float64 resolution limit at `1`) regardless of how precisely `z`
itself was computed — a catastrophic-cancellation ceiling inherent to the `1 - z` formula, not a
`recursiveSum` truncation issue. This is why #1189's calibrated parameter set below avoids `x <
0` probes entirely rather than attempting to also chase this separate, deeper numerical limitation.

## Prevention Strategy

Same as #1086/#1103's: any `recursiveSum` caller whose seed term includes a factor like
`exp(-theta/2)`, `exp(-lambda)`, or similar — i.e. any Poisson- or Gamma-mixing weight starting
its sum at index 0 rather than at the series' dominant term — should be checked for whether its
*leading* term can itself underflow below `EPS` while the series' eventual peak (and hence true
converged value) sits far later. If so, `{ useFloor: false }` is required, not optional, once
callers are exercised at large enough non-centrality/rate parameters. `noncentral-beta.js`
sidesteps the hazard differently (its sums start from the dominant Poisson index `i0`, found by
the same kind of peak search `DoublyNoncentralT._findStartIndex` already uses for `_pdf`, rather
than from index 0), but `noncentral-t.js`, `von-mises.js`, and the remaining `recursiveSum`
callers in `special/hypergeometric.js`/`special/bessel.js` are still unaudited for this specific
absolute-floor hazard and were out of scope here — #1189 only exercises `DoublyNoncentralT._cdf`.

## Related Solutions

- `solutions/correctness/2026-07-23-1108-doubly-noncentral-beta-recursivesum-absolute-floor-truncation.md`
  — the original diagnosis of this exact `recursiveSum` absolute-floor hazard class, for
  `DoublyNoncentralBeta`/`DoublyNoncentralF`.
- `solutions/correctness/2026-07-26-1339-vonmises-cdf-oscillating-term-premature-convergence.md`
  — a different flavor of premature convergence in the same shared helper (an oscillating term
  vanishing at a coincidental phase, rather than an absolute-floor mismatch), also found via
  #1143's boundary-grid methodology.

## Key Insight

A `recursiveSum` caller whose seed term already carries a Poisson/Gamma-style `exp(-rate)` factor
can underflow below the helper's absolute-floor convergence threshold before the series has done
any real work — deliberately calibrating boundary-adjacent precision-gate parameters (here, to hit
an unrelated `f11` dispatch threshold) is what pushed `theta` past that point for the first time
and surfaced a latent bug four other `recursiveSum` callers may still share.
