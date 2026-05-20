---
date: 2026-05-20T09:00:00Z
category: "testing"
problem: "NoncentralBeta/NoncentralF failed adTest at α=0.01 across seeds {0,42,12345}; root cause was errfix transcription artifact, not sampler or CDF defect"
status: complete
related_issue: "#267"
tags: [gof-test, anderson-darling, noncentral-beta, noncentral-f, false-positive-rate, errfix, lambda-zero]
---

# Solution: NoncentralBeta/NoncentralF AD failures were an errfix-transcription artifact

**Date**: 2026-05-20T09:00:00Z
**Category**: testing
**Related Issue**: #267

## Problem

After the KS→AD swap (#184), `NoncentralBeta(2,2,2)` and `NoncentralF(5,5,2)` failed
`adTest` consistently at α = 0.01 across seeds {0, 42, 12345}. The existing solution note
(`2026-05-19-1132-gof-test-swap-effective-alpha-empirical-calibration.md`) tightened
`AD_ALPHA` to 0.001 as a defensive measure and filed this issue to drill into whether the
failures reflected a real sampler or CDF defect.

## Investigation

### Hypothesis 1 — Sampler defect

Ruled out. A 500 000-sample ECDF comparison of both distributions against their analytic CDFs
showed no significant deviation at any quantile. All z-scores from `|ECDF(x) − CDF(x)| / SE`
were below 2 at every test point from x = 0.01 to x = 0.99 for NoncentralBeta, and x = 0.1
to x = 10 for NoncentralF. The sampler is correct.

### Hypothesis 2 — CDF precision gap

Ruled out. The analytic CDF matches the empirical distribution at the precision of 500 000
samples. Round-trip accuracy (sample → CDF → compare to ECDF) is consistent with a correct
implementation.

### Actual root cause

The "consistent failures across all three seeds" described in the #184 solution note were an
artifact of the **errfix transcription bug** fixed in commit `7395edb`:

- The digit transposition `0.04123 ↔ 0.04213` and the missing `/n` in the g2 branch of
  `_errfix` caused p-values to be systematically understated.
- After the errfix correction, the three-seed test results are:
  - Seed 0: FAIL at α = 0.01 (p ≈ 0.0045) — within expected Type I error
  - Seed 42: PASS (p ≈ 0.64)
  - Seed 12345: PASS (p ≈ 0.67)

A 500-seed sweep at α = 0.01, N = 10 000 gives a false-positive rate of ~1.6% for
NoncentralBeta and ~1.8% for NoncentralF, versus the expected 1%. Both are within 2σ of the
nominal rate and are not statistically significant (z ≈ 1.4 and 1.8 respectively).

The co-failures at the same seeds for both distributions are expected: `NoncentralF._generator`
calls `super._generator()` (i.e. `NoncentralBeta._generator`), so the two A-D results are
perfectly correlated for a given seed. They should not be counted as independent failures.

### Why seed=0 still fails

Seed 0 happens to generate a sample with A² ≈ 4.6 for NoncentralBeta (p ≈ 0.0045). This is
within the expected ~1% of the distribution of A² under H₀. Normal(0,1), Beta(2,2), and
Gamma(2,2) all pass comfortably at seed=0 (A² ≈ 1.3–1.8), confirming seed=0 is not
pathological — NoncentralBeta just has higher variance in A² for that particular PRNG sequence.

## Side Finding: lambda=0 NaN bug

During the code review, `NoncentralBeta._pdf` and `._cdf` were found to return `NaN` for
`lambda = 0`. The Poisson weight for k = 0, μ = 0 is `e^0 · 0^0 / 0! = 1`, but the
computation `Math.exp(-0 + 0 * Math.log(0) - logGamma(1))` evaluates `0 * (-Infinity) = NaN`
per IEEE 754. Fixed in this PR by guarding `l2 === 0 → p0 = 1`. The sampler was unaffected
(it calls `poisson(r, 0)` which correctly returns 0 via Knuth's method, yielding a chi-squared
variate as expected for the degenerate λ = 0 case).

## Conclusion

- **No sampler fix needed.** The generator is correct.
- **No CDF precision fix needed.** The analytic CDF is accurate.
- **`AD_ALPHA = 0.001` is appropriate** and conservative for all distributions in the suite;
  the test passes cleanly under this threshold.
- **Comments added** to the NoncentralBeta and NoncentralF test case entries in
  `test/dist-cases-continuous.js` documenting the conservative α and the errfix history.
- **lambda=0 NaN bug fixed** in `src/dist/noncentral-beta.js`.

## Prevention Strategy

When a newly-added GoF test consistently rejects a distribution that the previous test
accepted, the first question is: *is the test infrastructure itself correct?* Before diagnosing
sampler or CDF bugs, verify the test statistic and p-value approximation against a known-good
reference implementation. In this case the errfix transcription error was the real cause, and
the distribution code was correct throughout.
