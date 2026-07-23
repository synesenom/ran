---
date: 2026-07-23T11:08:52Z
category: "correctness"
problem: "DoublyNoncentralBeta pdf/cdf silently wrong by up to ~10 orders of magnitude for large lambda1+lambda2 away from x=0.5, and the diagnosed/planned fix (widen MAX_ITER) was insufficient on its own"
status: complete
related_issue: "#1086"
related_plan: "thoughts/plans/2026-07-23-0740-doubly-noncentral-beta-max-iter-truncation.md"
tags: [doubly-noncentral-beta, recursive-sum, convergence-check, absolute-vs-relative-tolerance, series-truncation, max-iter, poisson-mixing, verification-methodology, mpmath]
---

# Solution: DoublyNoncentralBeta pdf/cdf truncation — the diagnosed fix wasn't the real bug

**Date**: 2026-07-23T11:08:52Z
**Category**: correctness
**Related Issue**: #1086

## Problem

`DoublyNoncentralBeta(alpha, beta, lambda1, lambda2).pdf(x)`/`.cdf(x)` (and `DoublyNoncentralF`,
which delegates to it) returned a finite-looking but silently wrong value — off by up to ~10
orders of magnitude — once both non-centrality parameters were large (roughly
`lambda1 + lambda2 > 400-600`) and `x` moved away from 0.5. Example:
`DoublyNoncentralBeta(2,2,1200,1200).pdf(0.3)` returned `9.5e-31` against an mpmath (`dps=50`)
reference of `3.03e-21` — a ratio of ~3e10.

## Root Cause

The issue and its approved plan diagnosed a single cause: the outer Poisson-mixing loops
(`_pdfRForward`/`_pdfRBackward`/`_cdfRForward`/`_cdfRBackward` in
`src/dist/doubly-noncentral-beta.js`) were capped at `MAX_ITER=100` steps from the
`x`-independent Poisson mean `(r0, s0)`, but the summand's true peak shifts away from `(r0, s0)`
as `x` moves from 0.5 (e.g. ~146 steps at `x=0.3` for `r0=s0=600`) — a window of only 100 steps
can end before ever reaching it. The planned fix was to widen the cap to the already-provisioned
`MAX_SERIES_ITER=500`.

That fix was implemented first, exactly as planned — and empirically verified as *still wrong* by
~5 orders of magnitude on the issue's own reported case. Isolating the very first term of the
outer sum (`r = r0`, no recursion into the backward loop at all) showed the discrepancy was
already present there, which ruled out "the outer window is still too narrow" as the explanation.

The real bug was in the *inner* per-`r` sum over `s` (`_pdfSumOverS`/`_cdfSumOverS`), which used
the shared `recursiveSum` helper (`src/algorithms/recursive-sum.js`). Its convergence check is:

```js
if (Math.abs(delta) < EPS * Math.max(Math.abs(sum), 1)) break
```

The `Math.max(Math.abs(sum), 1)` floor assumes the running sum's magnitude is around 1 or
greater — reasonable for many series, but not for this one: the true converged pdf/cdf value at
`x` away from 0.5 with large lambda is itself astronomically small (~1e-21). With `|sum| << 1`,
the effective tolerance collapses to a fixed absolute `EPS` (~2.22e-16), which the second term of
the sum already satisfies trivially — `recursiveSum` was declaring "convergence" after 1-2 terms,
nowhere near the ~150+ terms actually needed to reach the series peak. This happened *inside* the
very first outer-loop iteration, which is why widening the outer cap alone did nothing: the inner
sum was already broken before the outer loop's window width ever came into play.

## Fix

- Widened the outer loop bound from `MAX_ITER` (100) to `MAX_SERIES_ITER` (500) in all four
  Poisson-mixing loops — the originally planned fix, still necessary, just not sufficient alone.
- Added a new file-local `_seriesSum` method: identical to `recursiveSum` except the convergence
  check drops the `,1` floor (`Math.abs(delta) < EPS * Math.abs(sum)`). Safe here specifically
  because every term summed by `_pdfSumOverS`/`_cdfSumOverS` is non-negative (a Poisson-weighted
  density or regularized-incomplete-beta value) — the floor in `recursiveSum` exists to guard
  against a sum trending toward legitimate cancellation-driven zero, a failure mode this
  particular sum cannot structurally have. Replaced the 4 call sites that previously called
  `recursiveSum` with `_seriesSum`.
- Deliberately did **not** modify `recursiveSum` itself: it's shared by ~6 other
  distributions/special functions (`NoncentralBeta`, `NoncentralT`, `DoublyNoncentralT`,
  `VonMises`, `special/hypergeometric.js`, `special/bessel.js`) whose own convergence behavior at
  extreme parameters was out of scope to re-verify for this issue. Filed as a separate follow-up,
  issue #1103.
- Added a precision-gate regression (`test/precision-continuous.js`) at
  `DoublyNoncentralBeta(2,2,1200,1200)`, `x=0.3` and `x=0.5`, verified against mpmath at
  `mp.dps=50`, plus a direct `pdf(0.5+x)=pdf(0.5-x)` symmetry regression (needed because
  `cdf(0.7)` at this lambda underflows to exactly `1.0` in float64, which would make a
  cdf-only symmetry check blind to a bug specific to the `x > 0.5` code path — and would
  silently break the quantile round-trip check if used as a precision-gate point directly).
- Sped up the Python mpmath reference generator's `dncbeta_pdf`/`dncbeta_cdf`
  (`scripts/precision-refs-continuous.py`) 10-20x via incremental log-gamma/log-beta recurrences
  (an exact algebraic rewrite, verified bit-identical against every existing small-lambda
  reference value), making the new large-lambda case tractable to regenerate through the
  standard pipeline instead of requiring an undocumented one-off script.

## Prevention Strategy

1. **"Loop cap too small" and "sum whose true value is far below the convergence helper's assumed
   baseline" are two different hazard classes that produce the identical symptom (a truncated
   series) but require different fixes.** Diagnosing one does not rule out the other — verify the
   *numeric output* against ground truth after applying a diagnosed fix, don't just confirm the
   loop now runs its full intended range.
2. **Any shared convergence-check helper using an absolute floor (`Math.max(|sum|, K)` for some
   constant `K`) to guard against premature convergence near zero should be audited per-caller**:
   does that caller's sum ever legitimately converge to a true value whose magnitude is far below
   `K`? If so, the floor causes false-positive convergence instead of protecting against it. The
   floor is only safe for callers whose sum is expected to stay near or above `K`, or where
   near-zero convergence specifically indicates cancellation (not a legitimately tiny answer).
3. **Before trusting "widen the cap" as a complete fix, independently re-verify the actual number**,
   not just that the loop completes. A wider outer cap can still be gated by an unrelated, tighter
   convergence check nested inside it — the bug can be one level deeper than the one named in the
   issue.
4. **Cross-validate a from-scratch, independent implementation against an existing trusted
   reference value before using it to judge a new case.** Here, a hand-written brute-force
   log-domain double sum (in plain JS) was first checked against an *already-verified* precision-gate
   value (`DoublyNoncentralBeta(2,2,2,2).pdf(0.55) = 1.5603241911925223`) before being trusted as
   ground truth for the new large-lambda case — this step is what caught that the first fix
   attempt was insufficient, rather than concluding "the loop now runs 500 times, done."

## Related Solutions

- `solutions/special-functions/2026-06-01-1330-bessel-i-miller-normalization-max-iter-truncation.md`
  — the same class of bug (a fixed `MAX_ITER` cap set below where the series peak actually falls,
  for large arguments) previously hit `besselI`'s normalization. That fix used a different
  technique (accumulating the normalization in-sweep via a closed-form identity, avoiding an
  external, separately-capped helper call entirely) — a useful alternative pattern when one
  exists, though no such identity was available here.

## Key Insight

A shared "stop when `delta` is small relative to `max(|sum|, 1)`" convergence helper silently
truncates any series whose true converged value is legitimately far below 1 — not just one
trending toward zero from cancellation — so a fix that only widens an *outer* loop's iteration cap
can leave the real bug, one level deeper in a shared summation helper, completely untouched;
always re-verify the numeric output against an independently cross-validated reference before
declaring a truncation bug fixed.
