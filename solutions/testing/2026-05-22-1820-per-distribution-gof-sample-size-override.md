---
date: 2026-05-22T18:20:00Z
category: "testing"
problem: "All 134 distributions share global GoF sample counts regardless of sampler quality, wasting CPU on distributions with provably exact samplers"
status: complete
related_issue: "#185"
related_plan: "thoughts/plans/2026-05-22-1810-issue-185-per-distribution-sample-size.md"
tags: [gof-test, anderson-darling, chi-squared, sample-size, per-distribution, sampleSize, test-performance, exact-sampler]
---

# Solution: Per-Distribution GoF Sample-Size Override

**Date**: 2026-05-22T18:20:00Z
**Category**: testing
**Related Issue**: #185

## Problem

`test/dist.js` applied two global constants — `AD_SAMPLE_SIZE = 5000` for the
Anderson-Darling GoF assertion on continuous distributions and `SAMPLE_SIZE = 10000`
for chi-squared GoF on discrete distributions — to all 134 distributions identically.
Distributions with provably exact samplers (Normal via Box-Muller, Exponential via
log-transform, Uniform via direct inversion) were over-sampled: the AD statistic
converges to adequate power far below 5000 for these cases, yet the suite paid the
full CPU cost every run. There was no extension point to express that fact.

## Root Cause

The test-case schema had `sampleParams` for per-distribution parameter overrides but
no `sampleSize` field. The constants `AD_SAMPLE_SIZE` and `SAMPLE_SIZE` were
hard-coded into `UnitTests.sample()` with no per-distribution opt-out path.

## Fix

Added an optional `sampleSize` field to the test-case schema in
`test/dist-cases-continuous.js` and `test/dist-cases-discrete.js`. In
`UnitTests.sample()` (`test/dist.js:173`):

```js
// per-distribution override for GoF assertion only; support-range check always uses SAMPLE_SIZE
const n = tc.sampleSize
```

The GoF assertion then uses `n ?? AD_SAMPLE_SIZE` (continuous) and `n ?? SAMPLE_SIZE`
(discrete), following the established null-coalescing pattern (`tc.sampleParams ?? tc.cases`,
`tc.testSeeds ?? [0, 42, 12345]`). The support-range check (`dist.sample(SAMPLE_SIZE)`) is
left unconditionally at the global constant — deterministic boundary detection does not
benefit from being reduced.

Three distributions were annotated with `sampleSize: 2500` and inline WHY comments:
- **Exponential**: log-transform sampler is exact; analytic CDF
- **Normal**: Box-Muller sampler is exact; analytic erf CDF
- **Uniform**: direct inversion; AD is distribution-free for exact CDFs

All 131 remaining distributions are unaffected — the `??` fallback restores the
previous behaviour when `sampleSize` is absent. Ten consecutive `npm test` runs
returned zero failures after the change.

## Prevention Strategy

When annotating a distribution with `sampleSize`:

1. **Only apply to the GoF assertion, never to the support-range check.** The support-range
   check must stay at `SAMPLE_SIZE` to preserve boundary-detection power. Reducing it would
   silently weaken the check that catches out-of-support values.

2. **Only reduce N for provably exact samplers.** Direct inversion, Box-Muller, and
   log-transform have no approximation error — reducing GoF N only trades power against a
   hypothetical sampler bug. Do not reduce `sampleSize` on rejection-sampler distributions
   (e.g., Moyal, RaisedCosine): rejection loops can fail in subtle tail-regime edge cases
   that require larger N to detect.

3. **Do not use `sampleSize` to suppress a flaky test.** A flaky GoF assertion is a signal
   to investigate (see `solutions/testing/2026-05-20-0900-noncentral-ad-root-cause-errfix-artifact.md`).
   Reducing N to make it pass masks the root cause.

4. **Always write a WHY comment next to `sampleSize`.** State the sampler type, the CDF
   property that justifies the reduction, and the assertion that 2500 (or chosen N) gives
   adequate power at `AD_ALPHA = 0.001`.

5. **Validate empirically.** Run `npm test` at least 10 times after adding a new `sampleSize`
   entry. Zero failures across all runs is the acceptance bar.

## Related Solutions

- `solutions/testing/2026-05-19-1132-gof-test-swap-effective-alpha-empirical-calibration.md` —
  AD/KS swap calibration: reducing N does not change `AD_ALPHA`; power trades against the rate
  at which real sampler defects are detected. Exact samplers have no defect to detect.
- `solutions/testing/2026-05-20-0900-noncentral-ad-root-cause-errfix-artifact.md` —
  Never reduce N to quiet a flaky test; always diagnose the root cause.

## Key Insight

Reducing GoF sample count does not raise the false-positive rate (fixed by `AD_ALPHA`); it
only reduces statistical power — so for distributions with provably exact samplers (direct
inversion, Box-Muller, log-transform), `sampleSize: 2500` is a safe performance optimisation,
but applying the same reduction to a rejection-sampler distribution could conceal a real defect.
