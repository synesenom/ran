---
date: 2026-06-01T13:30:00Z
category: "special-functions"
problem: "besselI(n, x) returned results wrong by exponentially many orders of magnitude for x ≳ 200 because the normalization helper _I0(x) truncated its Taylor series at MAX_ITER=100, far below the series peak at m ≈ x/2"
status: complete
related_issue: "#544"
related_plan: "thoughts/plans/2026-06-01-1230-bessel-miller-backward.md"
tags: [special-functions, bessel, miller-backward-recurrence, normalization, MAX_ITER, taylor-series, overflow, log-exp, dlmf-10.35.3, large-argument, convergence]
---

# Solution: besselI Miller normalization via in-sweep sum avoids MAX_ITER truncation

**Date**: 2026-06-01
**Category**: special-functions
**Related Issue**: #544

## Problem

`besselI(n, x)` returned results wrong by exponentially many orders of magnitude for
x ≳ 200. For example, `besselI(1, 200)` would silently return a value off by thousands
of orders of magnitude instead of the correct ~2×10⁸⁵. The same bug affected
`besselI(0, x)` for all large x, corrupting e.g. the VonMises normalizing constant.

## Root Cause

The backward recurrence loop itself was mathematically correct — Miller's algorithm
produces accurate unnormalized ratios `f_n / f_0` for all finite x. The bug was in the
final normalization step:

```javascript
y *= _I0(x) / bi   // line 123 in the old code
```

`_I0(x)` is a Taylor series that loops `for (let m = 1; m < MAX_ITER; m++)` with
`MAX_ITER = 100`. The series peak term occurs at m ≈ x/2; for x ≳ 200 this peak is
at m ≈ 100, so the loop exits at exactly the worst possible moment — right at the
series maximum, before any convergence. `_I0(x)` returned a value 10s to 100s of
orders of magnitude too small, making the final normalized result proportionally wrong.

The issue was invisible at small x (x ≤ 100) because MAX_ITER=100 is sufficient for
convergence when the peak is at m ≤ 50.

## Fix

The normalization scalar is now accumulated during the backward sweep itself using the
all-order sum identity (DLMF 10.35.3):

```
I_0(x) + 2·(I_1(x) + I_2(x) + ...) = e^x
```

A running `sum` accumulator is maintained in the loop: after each step,
`sum += 2 * bip` (where `bip = f_j` at that point). After the loop, `sum += bi`
adds `f_0`. The final result uses the log-exp form:

```javascript
return y * Math.exp(x - Math.log(sum))
```

This avoids both (a) the MAX_ITER truncation (no external series call) and (b) IEEE 754
overflow for x > ~710 where `Math.exp(x)` returns `Infinity`. The overflow guard inside
the loop was extended to rescale `sum` alongside `bi`, `bip`, and `y`, preserving the
ratio `y/sum` through any number of rescaling events.

For `besselI(0, x)`: the routing was fixed so that `|x| > 10` uses `_besselIBackward`
rather than `_I0` directly, ensuring both `n=0` and `n≥1` paths benefit from the fix.

## Prevention Strategy

1. **Never normalize Miller backward recurrence by calling a separate function**. The
   normalization anchor (`I_0(x)` or equivalent) must be accumulated from within the
   same sweep, using the applicable Wronskian or all-order sum identity for the function
   family. An external helper may have its own convergence limits that silently fail at
   the exact arguments where the recurrence is most needed (large x).

2. **When an overflow guard rescales accumulators, rescale ALL of them**. The guard
   must rescale every variable that participates in the final ratio. Omitting even one
   accumulator (here `sum`) breaks the normalization silently — the code runs without
   error but produces wrong output.

3. **Use log-exp form for large-x normalization**:
   `f_n * exp(x - log(S))` instead of `f_n * exp(x) / S`.
   The former is overflow-safe for all finite x; the latter overflows for x > ~710.

4. **Always add large-argument regression tests** (e.g., x = 50, 100, 200) with an
   independent asymptotic sanity check. The leading asymptotic `e^x/√(2πx)` provides
   a quick ~0.5% cross-validation that is completely independent of the implementation
   and will catch any normalization error larger than 1%.

## Related Solutions

- [`solutions/special-functions/2026-05-17-1540-erfc-crossover-cancellation.md`](./2026-05-17-1540-erfc-crossover-cancellation.md) — Same pattern of routing to two different algorithms with separate accuracy ranges; erfc fixed by adjusting the crossover threshold, besselI fixed by removing the external-helper normalization entirely.

## Key Insight

When normalizing Miller backward recurrence, accumulate `S = f_0 + 2·(f_1+f_2+…)` in-sweep and normalize as `f_n · exp(x − log S)` (DLMF 10.35.3) — calling a separate series evaluator to obtain the normalization anchor silently fails for large x if that series has a fixed `MAX_ITER` cap below its convergence depth.
