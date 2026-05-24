---
date: 2026-05-24T14:30:00Z
category: "performance"
problem: "Halley refinement in StudentT._q produces period-4+ oscillation and pre-existing Newton loop hangs at IBF noise floor"
status: complete
related_issue: "#381"
related_plan: "thoughts/plans/2026-05-24-1210-student-t-quantile-halley.md"
tags: [student-t, quantile, halley, newton, cornish-fisher, convergence, ibf, regularizedBetaIncomplete, noise-floor, oscillation]
---

# Solution: Halley higher-period oscillation + IBF noise-floor convergence detection

**Date**: 2026-05-24T14:30:00Z
**Category**: performance
**Related Issue**: #381

## Problem

`StudentT._q` used a 2-term Cornish-Fisher seed (A&S §26.7.8 g₁ and g₂) with Newton refinement
(~500K ops/sec for ν=5). Upgrading to Halley refinement introduced a new failure mode: for ν≥5
the loop hit `MAX_ITER` (100 iterations) on every call. Additionally a pre-existing bug caused
the Newton loop to also hit `MAX_ITER` for ν≥10 at moderate p values.

## Root Cause

Two compounding issues:

1. **Halley higher-period oscillation**: Halley's cubic convergence can produce period-4+ cycles
   near the fixed point when the CDF is computed via `regularizedBetaIncomplete` (IBF). The
   prior `tPrev` period-2 guard detects only period-2 oscillation; it misses longer cycles.

2. **IBF noise floor**: For ν≥10, the IBF argument `x = ν/(t²+ν)` approaches 1 from below for
   moderate t values. In this regime IBF precision degrades: `|dt| = |(F(t)−p)/f(t)|` stagnates
   at 4–110×EPS rather than converging to zero. The absolute convergence threshold
   `|dt| ≤ EPS·max(|t|,1)` can never be satisfied, and the loop runs to `MAX_ITER`. This
   pre-existing Newton bug was masked by tests that only used p=0.025, 0.5, 0.975 (where the
   IBF noise floor happened not to trigger).

## Fix

Two changes applied together:

1. **4-term Cornish-Fisher seed**: Extended from g₁–g₂ to g₁–g₄ (A&S §26.7.8), pre-computing
   `nu²`, `nu³`, `nu⁴` in `this.c`. Seed accuracy improves from ~1% to ~4 digits for ν≥3,
   reducing Halley iterations from ~5 to 1–2.

2. **Monotone convergence detection**: Replaced the absolute `|dt| ≤ EPS` threshold with a
   monotone-decrease check. The guard tracks `dtAbsMin` (running minimum of `|dt|`) and breaks
   *before applying the next step* when `dtAbsCurr >= dtAbsMin`. A floor of `4*EPS` catches the
   case where IBF already delivers machine-precision and the check would fire trivially.

   ```js
   let dtAbsMin = Infinity
   for (let i = 0; i < MAX_ITER; i++) {
     const dt = (this._cdf(t) - p) / this._pdf(t)
     const dtAbsCurr = Math.abs(dt)
     if (dtAbsCurr <= 4 * EPS * Math.max(Math.abs(t), 1) || dtAbsCurr >= dtAbsMin) {
       break  // keep current t — last applied iterate is the best
     }
     const tOld = t
     t -= dt / (1 + dt * (this.p.nu + 1) * t / (2 * (this.p.nu + t * t)))
     if (t === tPrev) { break }
     tPrev = tOld
     dtAbsMin = dtAbsCurr
   }
   ```

   Breaking *before* the step means the returned `t` is always the iterate that produced the
   smallest `|dt|` so far — the numerically best result regardless of noise-floor shape.

## Prevention Strategy

When upgrading from Newton to Halley in a quantile inversion loop backed by a special function:

- **Do not assume the period-2 guard (`tPrev`) is sufficient for Halley.** Halley's cubic
  convergence can create period-4+ oscillation near a noisy fixed point.
- **Use monotone-decrease detection, not an absolute threshold.** Track `dtAbsMin` and break
  when `|dt|` stops strictly decreasing. This handles both the higher-period oscillation case
  and the IBF noise-floor case in a single guard.
- **Check before, not after, applying the step.** Breaking before the step keeps the best `t`
  (the one that produced the minimum `|dt|`). Breaking after would discard one good step.
- **This pattern applies to any distribution whose CDF involves IBF, incomplete gamma, or
  similar special functions with precision limits well above machine epsilon.**

## Related Solutions

- `solutions/performance/2026-05-24-0630-erfinv-as-seed-negates-newton-speedup.md` — documents
  why A&S §26.2.17 rational approximation must be used as the normal-quantile seed (not erfinv)
- `solutions/performance/2026-05-23-1810-super-q-v8-megamorphic-deoptimization.md` — documents
  why subclass `_q` overrides must not use `super._q()`

## Key Insight

When Halley's method refines a quantile whose CDF is computed via `regularizedBetaIncomplete`,
replace the absolute `|dt| ≤ EPS` convergence guard with a monotone-decrease check
(`dtAbsCurr >= dtAbsMin`, evaluated before applying the step): this simultaneously prevents
the period-4+ oscillation that Halley can create near the fixed point and the pre-existing
Newton infinite loop that occurs when IBF precision stagnates above the EPS threshold.
