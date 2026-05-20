---
date: 2026-05-20T06:47:38Z
category: "algorithm"
problem: "_qEstimateTable silently broken for discrete distributions with negative-integer support; _qEstimateRoot non-deterministic and can return NaN"
status: complete
related_issue: "#284"
related_plan: "thoughts/plans/2026-05-20-0626-issue-284-q-estimate-walk.md"
tags: [quantile, discrete, infinite-support, walk, skellam, deterministic, _qEstimateWalk, _qEstimateTable, _qEstimateRoot]
---

# Solution: Deterministic linear walk for infinite-support discrete quantile estimation

**Date**: 2026-05-20T06:47:38Z
**Category**: algorithm
**Related Issue**: #284

## Problem

Discrete distributions with support that includes negative integers (e.g. Skellam, whose support is `(-∞, ∞)`) had a fragile and non-deterministic quantile path. `_qEstimateTable` always starts its expansion bracket at `k=0` and walks only upward, silently producing wrong quantiles for any `p` that maps to a negative integer. As a workaround, `Skellam._q` called `_qEstimateRoot` (the continuous Brent root-finder), applied `Math.floor` to snap the result to an integer, and added a one-step correction. Because `_qEstimateRoot` initialises its bracket with `Math.random()`, it can exhaust its 100-iteration cap without finding a sign change when `p` is near 0 or 1, returning `undefined`; `Math.floor(undefined)` is `NaN`, so `Skellam.q(p)` silently returned `NaN` in the extreme tails.

## Root Cause

The `Distribution` base class had no discrete quantile helper that accepted an externally-supplied starting point. The two available helpers were both wrong for the infinite-support discrete case:

- `_qEstimateTable` — hardwired expansion from `k=0` upward; incorrect for negative support.
- `_qEstimateRoot` — designed for continuous distributions with random bracket initialisation; can return `undefined` on infinite-support inputs.

The missing primitive was a deterministic integer walk anchored at a caller-known point such as the distribution mean.

## Fix

Added `_qEstimateWalk(p, start)` to `src/dist/_distribution.js` (between `_qEstimateTable` and `_qEstimateRoot`). The method takes an integer `start` supplied by the caller and walks toward the infimum quantile:

- If `cdf(start) >= p`: steps down while `cdf(k-1) >= p`.
- If `cdf(start) < p`: steps up while `cdf(k) < p`.

The exit condition (`cdf(k) >= p && cdf(k-1) < p`) directly encodes the discrete infimum quantile definition — no `ceil`/`floor` correction needed. The method is not wired into the `q()` dispatch; subclasses with a good analytic starting point call it explicitly from their `_q` override (e.g. Skellam can use `floor(μ₁ − μ₂)` as `start`).

## Prevention Strategy

When implementing `_q` for a new discrete distribution with support that includes negative integers or is not anchored at 0:

1. **Do not use `_qEstimateTable`** — it hard-codes its expansion start at `k=0` and is silently wrong for negative support.
2. **Do not use `_qEstimateRoot`** — it is designed for continuous distributions; its random bracket initialization can fail and return `undefined`, which becomes `NaN` after `Math.floor`.
3. **Use `_qEstimateWalk(p, floor(mean))`** where `floor(mean)` (or another analytically-known central parameter) is passed as `start`. The walk is O(|start − true_quantile|) steps; a good starting point like the mean keeps it O(σ).
4. **Guard `p=0` and `p=1` before calling `_qEstimateWalk`** — the public `q()` method already does this, but any `_q` override that calls `_qEstimateWalk` directly should not pass boundary probabilities, as they cause infinite loops (filed as #285).

## Related Solutions

- [`solutions/testing/2026-05-20-0459-discrete-quantile-ceil-minus-one-pattern.md`](../testing/2026-05-20-0459-discrete-quantile-ceil-minus-one-pattern.md) — Documents the `ceil(x)-1` fix for algebraic inverse quantiles and the `_qEstimateRoot` + floor + correction workaround that `_qEstimateWalk` supersedes. Issue #212.

## Key Insight

`_qEstimateTable` is silently broken for any discrete distribution with negative-integer support because it hard-codes its expansion start at `k=0`; use `_qEstimateWalk(p, floor(mean))` instead — it is always deterministic and correct so long as the caller supplies any finite integer near the answer.
