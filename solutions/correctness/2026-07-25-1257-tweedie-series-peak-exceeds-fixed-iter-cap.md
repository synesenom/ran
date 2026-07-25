---
date: 2026-07-25T12:57:07Z
category: "correctness"
problem: "Tweedie's PDF/CDF series silently truncate for parameter regimes where the peak term index exceeds the shared MAX_SERIES_ITER cap"
status: complete
related_issue: "#1136"
related_plan: "thoughts/plans/2026-07-25-1117-tweedie-distribution.md"
tags: [series-summation, iteration-cap, MAX_SERIES_ITER, tweedie, silent-truncation]
---

# Solution: fixed `MAX_SERIES_ITER` cap doesn't generalize to a parameter-dependent series peak

**Date**: 2026-07-25T12:57:07Z
**Category**: correctness
**Related Issue**: #1136

## Problem

`Tweedie`'s PDF series (`logDensitySeries`, the Dunn & Smyth 2005 log-space series) and CDF series
(a Poisson-weighted sum of `gammaLowerIncomplete` evaluations) would silently truncate to a wrong
finite value — no error, no `NaN`, no warning — for legitimate parameter combinations where the
series' true peak term index exceeds the codebase's shared `MAX_SERIES_ITER = 500` constant. The
PDF series' peak index, `jPeak = y^(2-p) / ((2-p)*phi)`, scales with the evaluation point `y`
itself and can exceed 500 for ordinary-looking inputs (e.g. `mu=100, phi=0.01` gives
`jPeak ~ 2000`). Confirmed by direct check: `pdf`/`cdf` at that parameter set matched the
independent mpmath reference before the fix would have silently diverged past `y` values whose
`jPeak` crossed 500.

## Root Cause

`MAX_SERIES_ITER` is one global constant (`src/core/constants.js`) reused as a fixed loop bound
across multiple series-based distributions (`NoncentralBeta`, `DoublyNoncentralBeta`, etc.) whose
series happen to peak near a magnitude that stays bounded across realistic parameter ranges (e.g.
a noncentrality parameter rarely reaching into the thousands in practice). Tweedie was first
written by copying that same fixed-iteration loop pattern from those sibling distributions without
re-deriving whether Tweedie's own peak index scales the same way — it doesn't: it grows with the
domain variable `y` raised to the power `(2-p)`, which has no natural upper bound (any user can
call `pdf(1e6)`), unlike a noncentrality-driven peak that's set once at construction time from a
parameter typically chosen in a bounded practical range.

A working dynamic-cap precedent already existed in the codebase —
`src/special/gamma-incomplete.js`'s `_gli` computes
`Math.max(MAX_ITER, Math.ceil(Math.sqrt(2 * (s + 1) * Math.log(1 / EPS))))` — but wasn't consulted
when `tweedie.js` was first drafted, because the author reached for the nearest structurally
similar *distribution* file (a Poisson-weighted series) rather than the nearest structurally
similar *convergence problem* (a series whose peak scales with an unbounded input).

## Fix

Replaced the fixed cap in both loops with a per-call dynamic cap derived from the same
Stirling-estimated peak already computed to center the log-space summation:

```js
// PDF series (logDensitySeries)
const iterCap = Math.max(MAX_SERIES_ITER, jPeak + 50)

// CDF series (_cdf)
const iterCap = Math.max(MAX_SERIES_ITER, Math.ceil(lambda) + 50)
```

mirroring the `gamma-incomplete.js::_gli` pattern: the fixed constant remains the floor for the
common case, but the loop extends automatically once the estimated peak would otherwise be cut off.

## Prevention Strategy

Before reusing `MAX_SERIES_ITER` (or any shared fixed iteration-cap constant) in a new
series-based distribution or special function, explicitly derive — and write down as a code
comment — where that series' term peaks as a function of the distribution's parameters *and* the
evaluation point, rather than assuming a sibling distribution's cap transfers unchanged. If the
peak index scales with a quantity that has no natural upper bound in valid usage (the evaluation
point itself, or a parameter users are free to set arbitrarily large or small), the cap must be
dynamic: `Math.max(FIXED_CAP, derivedPeakEstimate + margin)`, following the
`gamma-incomplete.js::_gli` precedent. When adding a new series-based distribution, match against
the nearest *convergence-behavior* precedent (how does the peak scale?), not just the nearest
*distribution-shape* precedent (is it also Poisson-weighted?) — two series can share a summation
skeleton while having structurally different peak-growth behavior.

## Related Solutions

- `solutions/correctness/2026-07-23-1108-doubly-noncentral-beta-recursivesum-absolute-floor-truncation.md`
  — a related but distinct bug class in a shared series-summation helper: that one was an
  *absolute-vs-relative convergence floor* silently declaring convergence too early for a series
  whose true sum is far below 1; this one is a *fixed iteration-count cap* silently exiting before
  reaching the series' dominant terms at all. Both are instances of "a shared convergence-related
  constant/helper doesn't generalize across every caller's numeric regime," but the failure
  mechanism and the fix (relative floor removal vs. dynamic iteration cap) are different enough to
  warrant separate documentation.

## Key Insight

A shared fixed iteration cap like `MAX_SERIES_ITER` is only safe for a series whose peak term
index is bounded by a parameter that stays near a fixed order of magnitude across realistic
inputs; for a series whose peak scales with the evaluation point itself, the cap must be computed
per-call from the same asymptotic peak estimate already used to center the summation — copying a
sibling distribution's fixed cap without re-deriving the peak-index formula silently truncates the
series for large or extreme inputs with no error signal.
