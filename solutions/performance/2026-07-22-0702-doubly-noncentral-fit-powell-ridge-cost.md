---
date: 2026-07-22T07:02:29Z
category: "performance"
problem: "DoublyNoncentralF/Beta.fit() took 13-30+ seconds on ordinary data; the confidently-diagnosed root cause turned out to be wrong"
status: complete
related_issue: "#1063"
related_plan: "thoughts/plans/2026-07-21-1928-doubly-noncentral-fit-slowdown.md"
tags: [doubly-noncentral-beta, doubly-noncentral-f, fit, powell, likelihood-ridge, unidentifiability, mocha-parallel-flakiness, profiling, misdiagnosis]
---

# Solution: DoublyNoncentralF/Beta `.fit()` slowdown — the confident diagnosis was wrong

**Date**: 2026-07-22T07:02:29Z
**Category**: performance
**Related Issue**: #1063

## Problem

`DoublyNoncentralF.fit()` (and `DoublyNoncentralBeta.fit()`, which its `_pdf`/`_cdf` delegate to) took 13-30+ seconds on ordinary data. Issue #1063's exact reproduction — `DoublyNoncentralF.fit()` on 500 `Rice(5,1)`-sampled points — measured 27.3s in this session.

## Root Cause

Research and a design-propose/design-critique agent pair both confidently converged on: `_pdfRBackward`/`_cdfRBackward` in `src/dist/doubly-noncentral-beta.js` had no iteration cap, unlike their `MAX_ITER`-bounded `_pdfRForward`/`_cdfRForward` counterparts, so a large trial `lambda1`/`lambda2` explored by Powell during `.fit()` could make the loop run arbitrarily long. This is a real asymmetry and was fixed (capped at `MAX_ITER` to match), but **empirically verifying the fix against the exact issue reproduction showed zero improvement**: 27.3s before, 27.6s after. Instrumenting the search showed why — across the *entire* Powell run, `r0`/`s0` never exceeded 14/83, both already well under the `MAX_ITER=100` cap that was just added. The "fix" never engaged on the reported case at all.

Further profiling (counting `_pdf` and `recursiveSum` invocations) found the real bottleneck: ~991,500 total `_pdf` calls (500 data points × ~1983 Powell objective evaluations), each triggering ~34 outer-loop iterations, each calling `recursiveSum` (~68 million calls total) averaging ~50 inner iterations each — roughly 3.4 billion primitive iterations in one `.fit()` call. This is not a runaway edge case; it is the aggregate cost of evaluating a genuinely expensive nested double-Poisson-mixing series many times.

Two more plausible fixes were tried and explicitly ruled out before the real cause was found:

- **Loosening `recursiveSum`'s convergence tolerance** (`Number.EPSILON` → `1e-12`) made things *worse* (64.6s) and changed the fitted parameters substantially — the added objective-function noise destabilized Powell's line search, causing it to converge to a different, worse region of parameter space instead of converging faster.
- **A better initial guess.** Starting Powell directly at the previously-observed "converged" optimum (the best possible starting point, bypassing `_fitInit` entirely) still took 105 seconds and 556,000 more `_pdf` calls, landing at yet another different point. This ruled out `_fitInit` as a lever: Powell's own bracketing/line-search mechanics (golden-ratio bracket expansion) explore far beyond the starting point by design, regardless of how good it is.

The actual cause: on data that does not genuinely belong to the `DoublyNoncentralF`/`Beta` family (`Rice(5,1)`-sampled data isn't F-shaped), the log-likelihood surface carries a long, near-flat ridge between the shape/degrees-of-freedom parameters and the non-centrality parameters — a classic near-unidentifiability between them. Powell's default tight relative convergence tolerance (`tol=1e-8`, inherited from the base `Distribution.fit()`) forces it to keep creeping along this ridge chasing negligible log-likelihood gains, and — critically — each step further along the ridge is *itself more expensive to evaluate*, since larger non-centrality parameters require more series terms per `_pdf` call. The cost compounds instead of merely accumulating.

## Fix

- `_pdfRBackward`/`_cdfRBackward` capped at `MAX_ITER` to match the forward loops — a real, defensive correctness fix, kept in the shipped change, but **not** the performance fix.
- `DoublyNoncentralBeta` (and transitively `DoublyNoncentralF`) now override `static fit()` with a much looser Powell search budget: `tol=1e-2, maxIter=15` instead of the base class's `tol=1e-8, maxIter=200`. This budget was calibrated empirically — tested against both the pathological (family-mismatched) case and well-matched data across multiple seeds, confirming parameter recovery on well-matched data still tracks the default optimizer's results within ordinary finite-sample noise, not degraded.
- The regression test asserts on `_pdf` call count (via prototype monkey-patching, restored in a `finally` block), not wall-clock time. A wall-clock assertion with an 8-second bound (5x the measured 1.5s) was still flaky under the full suite's `mocha --parallel` execution — CPU contention across worker processes caused enough variance to fail intermittently, the same flakiness class documented in `solutions/testing/2026-07-21-1055-guess-default-pool-latent-fit-cliff.md` for an unrelated full-pool `guess()` timing assertion. The test asserts a lower bound (Powell actually ran), an upper bound (call count stays bounded), and that the result's log-likelihood is no worse than `_fitInit`'s.

Two follow-up issues were filed rather than expanding this fix's scope further: #1078 (the backward-loop cap isn't truly symmetric for very large non-centrality parameters — could skip meaningful Poisson mass above `lambda ≳ 10000` — and no test exercises the region where the cap actually engages) and #1077 (the custom `fit()` duplicates the base class's logic; a protected `_powellOptions()` hook would avoid that, following the `_fitPenalty` precedent from ADR-0017).

## Prevention Strategy

**Always empirically re-verify a fix against the original, exact reproduction — not just a synthetic test of the targeted code path — before considering a performance issue closed.** A synthetic unit test can pass ("large lambda1/lambda2 now completes fast") while the real-world repro remains completely untouched, because the code path the fix targets may never actually be exercised by the real scenario. Profiling (call counts, hot-path instrumentation) is what surfaced the real bottleneck here; a plausible-sounding root cause — even one two independent agents converged on with high confidence — is a hypothesis until it's checked against measured behavior, not a conclusion.

For optimizer-in-the-loop performance problems specifically: don't assume a better initial guess or a looser numerical tolerance inside the objective will help by default. Both were tried here and made things worse or made no difference, because (a) a derivative-free line-search optimizer's own exploration mechanics can dominate regardless of starting point, and (b) objective-function noise can destabilize convergence rather than accelerate it. When an optimizer keeps making "progress" without ever converging to machine tolerance on badly-mismatched data, look for a near-flat/unidentifiable ridge in the likelihood surface before assuming the fix is in the per-evaluation cost.

## Related Solutions

- `solutions/testing/2026-07-21-1055-guess-default-pool-latent-fit-cliff.md` — first documented the same `DoublyNoncentralF` latency (from the `guess()` side) and the general principle that a mocha timeout cannot preempt synchronous work; also the precedent for routing tests around a known-slow path via deterministic assertions instead of trusting a single timing measurement.
- `solutions/special-functions/2026-06-01-1330-bessel-i-miller-normalization-max-iter-truncation.md` — established that a hard iteration cap is necessary even when theory predicts convergence, since optimizer-explored parameters can violate that assumption; this partly motivated (but did not turn out to solve) the initial backward-loop-cap hypothesis here.
- `decisions/0016-distribution-fit-powell-and-exact-mle.md` — rationale for Powell as `Distribution.fit()`'s optimizer and its existing barrier-objective guards.

## Key Insight

A performance fix that passes its own targeted regression test but hasn't been re-run against the *original* bug reproduction is not verified — profile the actual repro to find where the time really goes, because even a two-agent-confirmed, high-confidence first hypothesis can be completely wrong while still sounding entirely plausible.
