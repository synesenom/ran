---
date: 2026-08-11T20:26:32Z
category: "tooling"
problem: "Probing quantile(p) at p=1e-12 hangs the new quantile-accuracy sweep indefinitely on BetaNegativeBinomial and similar O(k)-recurrence discrete distributions"
status: complete
related_issue: "#1269"
related_plan: "thoughts/plans/2026-08-11-1900-quantile-accuracy-sweep.md"
tags: [tooling, differential-testing, quantile, beta-negative-binomial, catastrophic-saturation, bracket-search, performance]
---

# Solution: Tail-depth probing hang on BetaNegativeBinomial's O(k) CDF

**Date**: 2026-08-11T20:26:32Z
**Category**: tooling
**Related Issue**: #1269

## Problem

Building the round-trip metric for the new quantile-accuracy sweep (`scripts/difftest-quantile.py`), the plan initially set the round-trip sweep's tail depth to `p ∈ {1e-12, 1-1e-12}` (per a design-critique guardrail aimed at avoiding catastrophic-cancellation noise). Running this against the full ~146-distribution catalog caused an indefinite hang on `BetaNegativeBinomial(3,2,4)` — the harness never completed, with no error, exception, or timeout, just a stuck Node subprocess consuming 100% CPU.

## Root Cause

`BetaNegativeBinomial._cdf` (`src/dist/beta-negative-binomial.js`) has no closed form and is computed as an O(k) recurrence sum, recomputed from scratch on every call (no memoization across calls). In double precision this sum saturates well short of 1: empirically, `cdf(1e7)` and `cdf(3e8)` are bit-identical at `1 - 3.6e-11` — increments below that point are too small relative to the accumulated sum's mantissa to change it further, so the CDF asymptotes but never crosses `1 - 1e-12` no matter how large `k` grows.

Probing `q(1-1e-12)` against a CDF that can never mathematically reach that height sends the base class's `_qTableBracket` (`src/dist/_distribution.js`, nominally bounded by `MAX_ITER=100` from `core/constants`) through its full geometric bracket-expansion search hunting for a `k` that doesn't exist at that precision. By the late iterations `k` has grown to roughly `1.618^100` (astronomically large), and each iteration still pays for one O(k) `cdf()` call at that `k` — the search never terminates in feasible wall-clock time even though it is technically bounded by `MAX_ITER` in *iteration count*.

This is diagnostic-tooling code running head-first into a pre-existing numerical-precision ceiling in production code, not a new production bug — `_qTableBracket` behaves correctly for any target the CDF can actually reach; the harness was simply asking for a target that is mathematically unreachable at double precision for this distribution's parameterization.

## Fix

Lowered the harness's own tail-depth bound from `p ∈ {1e-12, 1-1e-12}` to `p ∈ {1e-6, 1-1e-6}` in `scripts/difftest-quantile.py`'s round-trip `p`-sampling (`P_TAIL_LO`, `P_TAIL_HI`) — still far deeper than the existing pdf/cdf sweep's `0.001`–`0.999` range (`difftest-dist.py`), but shallow enough to stay clear of any distribution's saturation point.

Verified empirically: probing all 146 catalog distributions at `{1e-6, 1-1e-6}` completes in ~2 seconds total; `{1e-12, 1-1e-12}` hangs indefinitely on `BetaNegativeBinomial` alone (confirmed via direct timing — the search never terminated within a 90+ second window before being killed).

## Prevention Strategy

When a differential-testing/accuracy harness picks a tail-depth bound to probe `quantile(p)` across an entire distribution catalog, the bound must be chosen against the catalog's *worst-case CDF numerical ceiling*, not just against a generically "deep enough to be interesting" target. Any distribution whose CDF is computed by an O(k) (or worse) recurrence with no closed form is a candidate for silently saturating below `1.0` in double precision well before the requested tail depth — and a bracket-search consumer of that CDF (base-class `_qTableBracket`/`_qEstimateRoot`, or any other geometric-expansion root finder) has no way to distinguish "genuinely needs a bigger bracket" from "target is mathematically unreachable at this precision," so it will burn through its full iteration budget paying for the O(k) evaluation at each step.

Before deepening a sweep's tail-probe bound, spot-check it against any known O(k)-summation distributions in the catalog (discrete compound/recurrence-based CDFs are the highest-risk group) with a short timeout, rather than assuming `MAX_ITER` alone bounds wall-clock time — `MAX_ITER` bounds iteration *count*, not iteration *cost*.

## Related Solutions

- `solutions/algorithm/2026-05-20-0647-q-estimate-walk-infinite-support-discrete.md` — related but distinct: addresses `_qEstimateWalk` random-initialization non-determinism for infinite-support discrete distributions, not `_qTableBracket`'s geometric-expansion cost blowup against an unreachable target.
- `solutions/correctness/2026-07-25-1257-tweedie-series-peak-exceeds-fixed-iter-cap.md` — related but distinct failure mechanism: a fixed iteration cap truncating a series' dominant terms, not a bracket search paying O(k) per iteration while hunting for an unreachable target.

## Key Insight

A tail-depth probe that looks merely "deep" against a distribution's *support* can be unreachable against that distribution's *numerical CDF ceiling* — always validate a new sweep's extremity bound against the catalog's worst-case CDF implementation (O(k) recurrences especially) before trusting `MAX_ITER` to keep it fast.
