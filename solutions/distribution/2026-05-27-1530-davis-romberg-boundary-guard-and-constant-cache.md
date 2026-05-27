---
date: 2026-05-27T15:30:00Z
category: "distribution"
problem: "Davis distribution: sample() returned 1, _cdf returned NaN, and n <= 1 was accepted"
status: complete
related_issue: "#447"
related_plan: "thoughts/plans/2026-05-27-1130-davis-generator.md"
tags: [davis, stub-generator, romberg, cdf, boundary-guard, constant-cache, zeta-gamma-mixture, nan, pdf]
---

# Solution: Davis distribution Romberg boundary guard and constant cache

**Date**: 2026-05-27
**Category**: distribution
**Related Issue**: #447

## Problem

The Davis distribution existed in `src/dist/davis.js` but was entirely non-functional. `sample()` always returned `1` because `_generator()` was a hard-coded stub (`return 1`). Additionally, `_pdf(x)` produced `NaN` at the lower support boundary `x = mu` because `y = x - mu = 0` causes `(0)^{-1-n} = Infinity` and `exp(Infinity) - 1 = Infinity`, yielding `Inf / Inf = NaN`, which propagated into Romberg integration and made `_cdf()` return `NaN` for all inputs. A third bug allowed construction with `n <= 1`, where the Riemann zeta function diverges, making the PDF formula mathematically undefined. The distribution was commented out of `src/dist/index.js` and had no test cases, so all three bugs went undetected.

## Root Cause

The file was a development skeleton committed before the mathematical content was complete. Two structural conditions allowed it to rot silently: (1) the export was commented out, making it invisible to the test runner, and (2) no test cases existed, so even if it had been exported, no assertion would have caught `sample()` returning a constant.

The NaN-at-boundary bug is a structural hazard for any distribution whose `_cdf` is implemented via Romberg integration from the support lower bound — Romberg evaluates `_pdf` at the starting point, which is exactly the boundary where the Davis PDF formula is singular: `(x - mu)^{-1-n}` diverges as `x → mu`, and `exp(b/(x-mu)) - 1` also diverges, producing `Inf/Inf = NaN`.

## Fix

Three coordinated fixes were applied:

1. **Boundary guards in `_pdf`**: `if (y <= 0) return 0` handles the Romberg lower-bound evaluation; `if (bOverY > 700) return 0` prevents `Math.exp()` overflow. `Math.exp(bOverY) - 1` was replaced with `Math.expm1(bOverY)` for numerical accuracy in the far tail.

2. **Parameter constraint tightened**: `['n > 0', 'n != 1']` → `['n > 1']`, matching the actual domain of the Riemann zeta function (pole at n=1).

3. **Exact sampler and constant cache**: `_generator()` replaced with the Zeta-Gamma mixture — draw `K ~ Zeta(n)`, draw `Y ~ Gamma(n, K)`, return `mu + b / Y`. The three special-function constants (`b^n`, `Gamma(n)`, `zeta(n)`) were moved to `this.c` to avoid recomputation inside Romberg's hundreds of evaluations per `_cdf` call. Without caching, 27 Davis tests ran in 2 minutes; with it, 9 seconds.

## Prevention Strategy

**For any distribution where `_cdf` is Romberg-integrated from the lower support bound:**

- `_pdf` must explicitly return `0` at `x = lower_bound` (not let the formula evaluate to `Inf/Inf = NaN`). Add `if (x - lower_bound <= 0) return 0` before any formula evaluation.
- All special-function constants in `_pdf` must be precomputed in `this.c`. Each `_cdf` call triggers O(100–1000) `_pdf` evaluations; per-call special-function overhead (gamma, zeta, beta, etc.) compiles into minutes of test time.

**General skeleton-distribution rule** (see also Champernowne fix):
A distribution is not present in the codebase until it has:
1. An uncommented export in `src/dist/index.js`
2. At least one `refVals` entry in `test/dist-cases-*.js` (verified against Python/R, not from the same JS code)
3. A working `_generator()` — never a hard-coded constant

## Related Solutions

- `solutions/correctness/2026-05-23-1300-champernowne-stub-normalization-cdf-generator.md` — same stub-distribution anti-pattern (skeleton committed before export and tests)

## Key Insight

For distributions where `_cdf` is Romberg-integrated from the lower support bound, `_pdf` must explicitly return `0` at that boundary (not let the formula evaluate to `Inf/Inf = NaN`), and all special-function constants must be cached in `this.c` — the combination of an unguarded boundary and uncached gamma/zeta calls makes the distribution both mathematically broken and orders of magnitude too slow to test.
