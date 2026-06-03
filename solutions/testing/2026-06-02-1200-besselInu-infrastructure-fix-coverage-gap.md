---
date: 2026-06-02T12:00:00Z
category: "testing"
problem: "besselInu had no large-argument tests; infrastructure fix in a prerequisite issue left coverage gap undetected"
status: complete
related_issue: "#629"
related_plan: "thoughts/plans/2026-06-02-1110-besselInu-large-argument-tests.md"
tags: [bessel, recursiveSum, MAX_SERIES_ITER, large-argument, coverage-gap, infrastructure-fix]
---

# Solution: besselInu Infrastructure Fix Coverage Gap

**Date**: 2026-06-02T12:00:00Z
**Category**: testing
**Related Issue**: #629

## Problem

`besselInu(nu, x)` had no large-argument test coverage. Issue #629 was filed reporting wrong
values for x ≳ 200 because the Taylor series in `recursiveSum` exited at i=99 (before the
series peak at i ≈ x/2). By the time the issue was investigated, the bug was already gone:
issue #564 had silently fixed it by raising `recursiveSum`'s iteration cap from `MAX_ITER=100`
to `MAX_SERIES_ITER=500`. There was no failing test to signal the missing coverage.

## Root Cause

Infrastructure fixes that improve a shared primitive (`recursiveSum`'s iteration cap) resolve
bugs across every caller, but verification tests are only added for the directly-reported
caller. Downstream callers that were also broken — and are now also fixed — are never
explicitly exercised. The coverage gap is invisible because there is no failing test to draw
attention to it.

## Fix

Added a `describe('.besselInu()')` block to `test/special.js` (lines 235-273) with:
- Small-x regression values at x=1, x=10 for ν=0.5, 1.5, 2.3 (locks in unchanged behavior)
- Asymptotic leading-term sanity check at x=50: `|I_{0.5}(50)·sqrt(2π·50)/e^50 - 1| < 0.01`
  (for ν=0.5, μ=4ν²=1 so all asymptotic correction terms vanish — the leading term is exact)
- Exact large-argument reference values at x=50, 100, 200 for ν=0.5 and ν=1.5 derived from
  closed-form identities: `I_{0.5}(x) = sqrt(2/(πx))·sinh(x)` and
  `I_{1.5}(x) = sqrt(2/(πx))·(cosh(x) − sinh(x)/x)` — independently verifiable, not
  bootstrapped from the implementation
- Asymptotically-validated reference values for ν=2.3 (no closed form; cross-validated to
  1e-15 relative error against DLMF 10.40.1 with optimal truncation)

No production code changes were needed; the Taylor series with `MAX_SERIES_ITER=500` converges
correctly for all x ≤ 710 (beyond which I_ν(x) > 1.8e308, making Infinity the correct result).

## Prevention Strategy

When an infrastructure fix is merged and documented in the CHANGELOG as improving accuracy for
a specific caller, immediately audit every other caller of the same primitive and add
large-argument regression tests for each. The audit belongs in the same release cycle, not
reactively when the next bug report arrives.

**Practical trigger**: whenever the CHANGELOG records a fix to `recursiveSum`, `neumaier`,
`chandrupatla`, or any other shared numerical utility, grep for all call sites:

```bash
grep -r "recursiveSum\|neumaier\|chandrupatla" src/ --include="*.js" -l
```

For each call site, verify that tests exercise the argument range where the utility was
previously deficient. If a call site lacks tests at those arguments, file a companion issue
immediately.

## Related Solutions

- `solutions/special-functions/2026-06-01-1330-bessel-i-miller-normalization-max-iter-truncation.md`
  — Same class of bug for integer-order `besselI` (#544). That case required an algorithmic
  replacement (Miller backward recurrence) because the Taylor series itself was the wrong
  approach. Here, the Taylor series is correct once the iteration cap is sufficient.

## Key Insight

When a shared-primitive fix resolves bugs across multiple callers, only the directly-reported
caller gets verification tests — explicitly audit all call sites and add large-argument
regression tests for each, or every downstream caller will surface as a separate bug report.
