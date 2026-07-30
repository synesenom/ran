---
date: 2026-07-30T16:07:00Z
category: "correctness"
problem: "DoublyNoncentralT(nu, mu, theta).pdf(x) is silently wrong (up to ~13% relative error observed) when mu is non-zero and large relative to nu, combined with large theta"
status: complete
related_issue: "1207"
tags: [doubly-noncentral-t, hypergeometric, f11, contiguous-recurrence, numerical-instability, precision-gate]
---

# Solution: DoublyNoncentralT `_pdf` unstable ₁F₁ contiguous recurrence for large mu/theta

**Date**: 2026-07-30T16:07:00Z
**Category**: correctness
**Related Issue**: #1207

## Problem

`ran.dist.DoublyNoncentralT(nu, mu, theta).pdf(x)` returned significantly wrong probability
density values (up to ~13% relative error observed) once `mu` was non-zero and large relative to
`nu`, combined with large `theta`. Concretely, for `DoublyNoncentralT(5, 5, 120)`:

- `pdf(1.3)` returned `0.8149681936132279`, vs. the mpmath (`mp.dps=50`) reference
  `0.71818185584468099...` — a ~13% relative error.
- `pdf(0.7)`, `pdf(1.0)`, `pdf(1.8)` were also measurably wrong (relative errors ≈ 1.1e-4, 4.6e-5,
  1.7e-3 respectively), with the error non-monotonic in `x`.

This was invisible to the existing precision-gate suite: every prior `DoublyNoncentralT` parameter
set either used `mu = 0` (which takes an entirely different, single-term fast path — see
`solutions/correctness/2026-07-28-1024-doubly-noncentral-t-cdf-recursivesum-absolute-floor-truncation.md`'s
`(5, 0, 120)` group) or a small `theta` that never pushed the series' peak index `j0` past ~5-10.

## Root Cause

`_pdf`'s general (`mu != 0`) branch (`src/dist/doubly-noncentral-t.js`) sums an infinite series
over index `j`, where each term needs Kummer's confluent hypergeometric value
`₁F₁(kⱼ, ν/2, θ/(2·tk))`, `kⱼ = (ν+j+1)/2`. Rather than calling the library's `f11()` special
function (`src/special/hypergeometric.js`) fresh at every index, the series walk advanced `₁F₁`
incrementally via the standard three-term contiguous relation in its first argument
(`a·M(a+1,b,z) = (2a-b+z)·M(a,b,z) + (b-a)·M(a-1,b,z)`), implemented as two private methods,
`_f11Forward`/`_f11Backward`.

Both directions of this recurrence are numerically unstable once `a` (≈`kⱼ`) grows large relative
to `b` (=`ν/2`) — the exact regime `theta=120` with non-zero `mu` drives the series into (peak
index `j0` in the 17-30+ range for `DoublyNoncentralT(5, 5, 120)`). Empirically, at
`x=1.3` (`j0=29`, `a` ranging ~17-36, `b=2.5`, `z≈44.8`):

- **Forward** (`_f11Forward`): the very first recurrence step already produced a value 330% too
  large relative to a direct `f11()` call at the same `(a,b,z)` — the error was immediate and
  large, not a slow accumulation.
- **Backward** (`_f11Backward`): started with a smaller ~77% relative error one step from the peak,
  but grew monotonically to 9 orders of magnitude of relative error by the time the walk reached
  `j≈1`.

This is the classic failure mode of a linear three-term recurrence whose two independent solutions
have very different growth rates: recursing in a direction that amplifies the "wrong" (minimal)
solution lets rounding error introduced at any single step grow relative to the true value as the
recursion proceeds — and, unusually, **both** directions were unstable for this parameter regime,
not just one (see Miller's algorithm / backward-recurrence literature for the general theory).

Confirmed by direct experiment: replacing every `_f11Forward`/`_f11Backward` call with a direct
`f11(kⱼ, ν/2, thetatk)` call reproduced the mpmath reference values to ~1e-13–1e-15 relative
error (full float64 precision) at all four points from the issue — ruling out `f11()` itself,
`_findStartIndex`, `_logA`, and the `gp`/`gk` running-product prefactor as sources of error.

## Fix

Deleted `_f11Forward`/`_f11Backward` entirely and replaced their four call sites in `_pdf` (the
forward and backward walks in both the `recursiveSum`-based `x*mu >= 0` branch and the
`wynnEpsilon`-based `x*mu < 0` branch) with a direct `f11(kⱼ, ν/2, thetatk)` call, using the same
`kⱼ` variable each call site already computed for its `gk` (Gamma running-product) update. The
`gp`/`gk` running-product prefactor machinery — already proven correct — was left untouched; only
the hypergeometric-value bookkeeping (`f1`/`f2` interleaved arrays tracking two prior values per
parity chain) was removed, since direct evaluation needs no history.

This follows the codebase's established precedent for unstable special-function algorithms —
replace the algorithm entirely rather than add an instability-detection-and-fallback hybrid (see
`solutions/special-functions/2026-07-05-1530-bessel-k-second-kind-cancellation-strategy.md` and
`solutions/special-functions/2026-06-01-1330-bessel-i-miller-normalization-max-iter-truncation.md`)
— because reliably detecting "the recurrence is about to go wrong" ahead of time is itself an
unsolved problem here, and no such heuristic was established or validated for this recurrence.

Verified against the mpmath (`mp.dps=50`) reference (via `scripts/precision-refs-continuous.py`'s
independent Poisson-mixture `dnct_pdf`/`dnct_cdf` formulas, not derived from ranjs's own
`₁F₁`-series `_pdf`) for `DoublyNoncentralT(5, 5, 120)` at `x = 0.7, 1.0, 1.3, 1.8, 2.2`: both
`pdf` and `cdf` now match to ~1e-11 to ~1e-15 relative error, previously off by up to 13%. A new
precision-gate group covering this parameter set was added to `test/precision-continuous.js`.

## Residual Limitation (out of scope)

The `x*mu < 0` (`wynnEpsilon`-based alternating series) branch was also spot-checked against the
same mpmath Poisson-mixture reference at `(nu=5, mu=5, theta=120)`, negative `x`: even after this
fix, `pdf(-0.7)` computed `3.85e-12` vs. the mpmath reference `8.08e-15` — roughly 475x off in
relative terms (though both are minuscule absolute values deep in the left tail). Removing the
`_f11Forward`/`_f11Backward` recurrence did not resolve this branch, because its series is
genuinely alternating: individual terms can be many orders of magnitude larger than the converged
(heavily cancelled) sum, and no amount of correctly-evaluated per-term `f11()` values recovers
precision lost to catastrophic cancellation in a double-precision accumulation — `wynnEpsilon`'s
acceleration mitigates but does not eliminate this. This is a distinct numerical problem
(cancellation, not recurrence instability) and was flagged as out of scope for #1207, whose
confirmed data and acceptance criteria are entirely `x*mu >= 0`. Filed as a follow-up during this
PR's bug-triage stage.

## Prevention Strategy

Any per-distribution "advance a special function incrementally via a contiguous/recurrence
relation across a series index" optimization (as opposed to calling the special function fresh
each time) should be treated as suspect once the relevant parameter (here, the hypergeometric's
first argument `a`) grows large relative to the function's other parameters — three-term
recurrences for confluent-hypergeometric-like functions are a classical source of instability in
**either** direction, not just one. When adding a new large-parameter precision-gate group for any
distribution that uses such a recurrence, check the recurrence's inputs against a direct call to
the underlying special function before trusting the recurrence's output.

## Related Solutions

- `solutions/correctness/2026-07-28-1024-doubly-noncentral-t-cdf-recursivesum-absolute-floor-truncation.md`
  — a different, previously-fixed bug in this same file's `_cdf` (premature `recursiveSum`
  convergence, not recurrence instability).
- `solutions/special-functions/2026-07-05-1530-bessel-k-second-kind-cancellation-strategy.md` and
  `solutions/special-functions/2026-06-01-1330-bessel-i-miller-normalization-max-iter-truncation.md`
  — prior precedent for replacing an unstable special-function algorithm entirely rather than
  adding a stability-detection fallback.

## Key Insight

A three-term contiguous recurrence advancing a confluent-hypergeometric-like function across a
series index is not automatically "the stable direction vs. the unstable direction" — for this
distribution's parameter regime, **both** the forward and backward directions were unstable, and
the fix was to stop relying on the recurrence altogether in favor of the already-correct direct
special-function call, accepting an O(1)→O(series-length) per-step cost increase in exchange for
correctness.
