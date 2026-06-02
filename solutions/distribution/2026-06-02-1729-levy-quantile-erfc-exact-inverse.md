---
date: 2026-06-02T17:29:00Z
category: "distribution"
problem: "Levy.q(p) fell through to bracket-expansion root-finder despite the CDF being analytically invertible"
status: complete
related_issue: "#619"
related_plan: "thoughts/plans/2026-06-02-1702-issue-619-levy-quantile.md"
tags: [levy, quantile, erfinv, erfc, _q, closed-form, inverse-CDF, bracket-expansion, performance]
---

# Solution: Lévy quantile exact inverse via erfinv

**Date**: 2026-06-02T17:29:00Z
**Category**: distribution
**Related Issue**: #619

## Problem

`Levy.q(p)` for all inputs fell through to the base class `_qEstimateRoot()` path — a
golden-ratio bracket expansion starting near the lower support boundary followed by
Chandrupatla root-finding. For extreme quantiles (p=0.99 with default params yields Q≈12,731)
the bracket expansion requires roughly 30 doublings before it even finds a sign change, making
Lévy quantile computation O(iterations) where no iteration was necessary.

## Root Cause

The Lévy CDF `F(x) = erfc(sqrt(c / (2*(x−μ))))` is analytically invertible to
`Q(p) = μ + c / (2·erfinv(1−p)²)`. This closed-form inverse was never implemented as `_q(p)`.
The `erfinv` function was already exported from `src/special/index.js`; the only missing piece
was recognising that the CDF inversion was tractable and writing the two-line method.

## Fix

Added `_q(p)` implementing the exact formula directly:

```js
_q (p) {
  const z = erfinv(1 - p)
  return this.p.mu + 0.5 * this.p.c / (z * z)
}
```

`erfinv` is used here to produce the **final answer** in O(1), not as a seed for a downstream
Newton loop. This is the correct use of `erfinv` — the known performance concern (see related
solution) only applies when `erfinv` is used purely to initialise another iterative method.

The existing `_generator()` was left unchanged to preserve sample reproducibility for seeded
instances; the normal-variate transform it uses is mathematically equivalent and avoids an
`erfinv` call per sample.

## Prevention Strategy

Before implementing a fallback-based or iterative quantile for any distribution, check whether
the CDF equation can be directly inverted analytically. For distributions in the **erfc family**
— where `F(x) = erfc(g(x))` for some monotone `g` — the inverse is always
`x = g⁻¹(erfinv(1−p))` and `erfinv` is the right tool.

Checklist:
1. Write down the CDF.
2. Isolate the argument of the outermost special function.
3. Check if all remaining operations have known closed-form inverses.
4. If yes, write `_q(p)` directly; do not reach for bracket search.

This checklist catches Lévy, Moyal (already fixed in #548), and any future `erfc`-based
distribution before they accumulate the bracket-search anti-pattern.

## Related Solutions

- `solutions/performance/2026-05-24-0630-erfinv-as-seed-negates-newton-speedup.md` — the
  complementary rule: `erfinv` as a Newton seed is slow (~9.5µs, dominates total cost);
  `erfinv` as the direct final answer is fully justified and fast.
- `solutions/special-functions/2026-05-17-1540-erfc-crossover-cancellation.md` — `erfc`
  precision near x∈(1,2] (Lévy's CDF uses `erfc`; its accuracy underpins `_q` correctness).

## Key Insight

When a distribution's CDF is `erfc(g(x))`, the quantile formula follows immediately by
inverting `erfc`: `Q(p) = g⁻¹(erfinv(1−p))` — `erfinv` produces the exact final answer in
O(1), making the bracket-expansion fallback unnecessary.
