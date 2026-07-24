---
date: 2026-07-24T19:30:00Z
category: "special-functions"
problem: "erfcx-based cancellation-avoidance rewrite, copied from a precedent with a sign-guaranteed argument, produced NaN for the opposite sign"
status: complete
related_issue: "#1131"
related_plan: "thoughts/plans/2026-07-24-1755-emg-distribution.md"
tags: [erfcx, erfc, cancellation, overflow, sign-branch, exponentially-modified-gaussian, inverse-gaussian]
---

# Solution: EMG's erfcx rewrite needed a sign branch, not a single substitution

**Date**: 2026-07-24
**Category**: special-functions
**Related Issue**: #1131

## Problem

Implementing `ExponentiallyModifiedGaussian`'s PDF/CDF (both share a term of the form
`exp(exponent) * erfc(arg)`), the first pass rewrote this unconditionally as
`exp(exponent - arg^2) * erfcx(arg)` to avoid the classic `exp(large) * erfc(large->0)`
cancellation — the same technique `InverseGaussian`'s CDF already uses
(`solutions/special-functions/2026-06-05-0000-inverse-gaussian-cdf-erfc-cancellation-cf-convergence.md`).
Random-parameter fuzz assertions in `test/dist-runner.js` ("pdf should be non-negative",
"cdf should be in [0, 1]") immediately produced `NaN` for `x` far to the right of the
distribution.

## Root Cause

`erfcx(z) = exp(z^2) * erfc(z)` is only numerically safe for `z >= 0` — that is the entire
reason the function exists: `erfc(large positive)` underflows toward 0, and the compensating
`exp(z^2)` factor recovers the true (small but nonzero) magnitude of the product. For `z < 0`,
`erfc(z)` stays bounded near 2 while `exp(z^2)` diverges, so `erfcx(z)` itself overflows to
`Infinity` — `ranjs`'s own `erfcx()` (`src/special/error.js:100-104`) already branches on the
sign of its argument internally for exactly this reason.

In `InverseGaussian`'s CDF, the argument passed to `erfcx` is provably non-negative by the
formula's structure, so the single-branch rewrite is safe there. In EMG, the analogous argument
`arg = (mu + lambda*sigma^2 - x) / (sqrt(2)*sigma)` can be either sign, because EMG's support is
all of R and `x` can be arbitrarily larger than `mu + lambda*sigma^2`. The rewrite was copied
from the `InverseGaussian` precedent without checking whether the sign guarantee that made it
safe there also held for the new formula — it didn't.

## Fix

Split the shared term into a private `_erfcTerm(x)` helper with two branches on the sign of
`arg` (`src/dist/exponentially-modified-gaussian.js`):

- `arg <= 0`: use the naive direct form `exp(exponent) * erfc(arg)`. Safe here because
  `erfc(arg)` is O(1)-bounded for non-positive arguments, and `exponent` is itself bounded above
  by `-lambda^2*sigma^2/2` in this regime, so `exp(exponent)` can only underflow toward 0, never
  overflow.
- `arg > 0`: use the rewrite `exp(exponent - arg^2) * erfcx(arg)`. Safe here for the mirror
  reason — this is the `InverseGaussian`-precedent regime.

The identity `exponent - arg^2 = -(x-mu)^2 / (2*sigma^2)` holds algebraically regardless of
sign, so both branches compute the same mathematical quantity; only the numerically safe *form*
of the computation differs by branch. This mirrors exactly how `erfcx()` itself is implemented.

## Prevention Strategy

When reusing an `erfc`/`erfcx` cancellation-avoidance rewrite from a prior distribution as a
precedent, don't just copy the algebraic substitution — check whether the source case's safety
depended on a sign/domain guarantee on the argument that the new case does not share. Before
applying a single-branch `erfcx` rewrite, ask: *can the argument to `erfcx` be negative here?*
If the support or parameter range allows the argument to cross zero, the rewrite needs a
sign-based two-branch split (mirroring `erfcx()`'s own internal branching in
`src/special/error.js:100-104`), not the unconditional single-expression form.

This class of bug — a stability rewrite valid in one tail but not the other — will not surface
in a handful of hand-picked precision-gate points clustered near the CDF's middle quantiles; it
only appears in the far tail. Generic random-parameter fuzz assertions across a wide `x` range
(`dist-runner.js`'s non-negativity / [0,1]-range checks) are what actually caught it here, so
that coverage should not be weakened or treated as redundant with the targeted precision gate.

## Related Solutions

- `solutions/special-functions/2026-06-05-0000-inverse-gaussian-cdf-erfc-cancellation-cf-convergence.md` — the precedent whose single-branch `erfcx` rewrite was copied without its sign guarantee.
- `solutions/special-functions/2026-05-17-1540-erfc-crossover-cancellation.md` — the original `erf`/`erfc` series/continued-fraction crossover this whole family of fixes builds on.

## Key Insight

`erfcx(z)` (and any `exp(large) * erfc(small)` cancellation rewrite) is only numerically safe
for the sign of the argument it was designed for — copying such a rewrite from a precedent whose
argument has a proven sign guarantee into a new formula whose argument can take the opposite
sign turns an overflow-avoidance fix into a new `Infinity * 0 = NaN` bug; always branch on the
argument's sign, as `erfcx()` itself does internally, rather than applying the rewrite
unconditionally.
