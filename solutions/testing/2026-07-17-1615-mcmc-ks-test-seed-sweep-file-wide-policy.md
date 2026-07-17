---
date: 2026-07-17T16:15:03Z
category: "testing"
problem: "test/mc.js had two independent fixes for unseeded/single-seed KS-test flakiness (ARS, Gibbs) that were never generalized into a file-wide policy, leaving 11 more KS-test blocks -- one of them fully unseeded -- on undocumented single pinned seeds"
status: complete
related_issue: "#1000"
related_plan: "thoughts/plans/2026-07-17-1242-mcmc-ks-test-seed-pinning-policy.md"
tags: [ks-test, seeded-tests, flaky-tests, statistical-tests, false-positive-rate, mc, ci-stability, file-wide-policy, seed-hunting]
---

# Solution: A per-sampler flakiness fix is a file-wide policy, not a one-off patch

**Date**: 2026-07-17T16:15:03Z
**Category**: testing
**Related Issue**: #1000

## Problem

`test/mc.js` contains distributional KS-test blocks for 9 MCMC samplers (RWM, AdaptiveMetropolis, HMC, Gibbs, MALA, NUTS, ARS, SliceSampler, ParallelTempering). Two prior sessions independently diagnosed and fixed the same underlying defect for a single sampler each: ARS's KS test flaked in CI at exactly its own significance-level false-positive rate (issue #820), and Gibbs's `.seed()` call turned out not to reach its actual randomness source (issue #824). Both fixes converted their sampler's tests from a single seed to a fixed three-seed sweep (`[0, 42, 12345]` for ARS, `[0, 7, 42]` for Gibbs) and documented the rationale in a solution doc.

Neither fix was generalized into a file-wide audit. Eleven more KS-test blocks across RWM (main + joint-proposals), AdaptiveMetropolis (main + joint-proposals), HMC (three separate blocks), MALA, NUTS, and SliceSampler (two blocks) were left on single pinned seeds with no comment explaining why that seed was chosen or that alternative seeds might legitimately fail — the exact "seed-hunting" risk issue #1000 was filed to close. One of those blocks, AdaptiveMetropolis's main distributional test, had no `.seed()` call at all: it was drawing from `Math.random()`-seeded entropy on every CI run, carrying the full undocumented ~1% flake rate the ARS solution doc had already diagnosed and fixed elsewhere in the same file.

## Root Cause

`ksTest()`'s critical value (`test/test-utils.js`, `D <= 1.628/√n`) is the standard two-sided asymptotic KS constant for α ≈ 0.01 — not the 5% issue #1000's body used as an illustrative estimate. Every unseeded or single-shot call to it carries an inherent ~1% chance of failing a run that exercises entirely correct code, purely from the sampled draw landing on the wrong side of the threshold. That defect was fixed twice, once per affected sampler, without ever asking "does this same anti-pattern exist anywhere else in this file?" — so it persisted, undocumented, in 11 more blocks (plus one genuinely unseeded block) until a dedicated file-wide pass closed it.

## Fix

All 11 remaining single-seed or unseeded `ksTest()` blocks in `test/mc.js` were converted to the `[0, 42, 12345]` sweep already used by ARS and ParallelTempering, via a new module-level `const SEEDS = [0, 42, 12345]` and the same `SEEDS.forEach(seed => it(...))` structural pattern already proven correct in the file. AdaptiveMetropolis's main distributional test was seeded for the first time. A file-level WHY comment (`test/mc.js:19-29`) now states the α≈0.01 derivation and the seed-sweep rationale once, instead of leaving it implicit or repeated inconsistently per block, and cross-references the two prior solution docs. Gibbs's `[0, 7, 42]` variant, and ARS/ParallelTempering's existing sweeps, were deliberately left untouched — they already satisfied the target policy, and the design decision (confirmed with the user after a low-confidence design-critique pass) was that "consistently applied" means every `ksTest()` call site uses *a* documented multi-seed sweep, not that every site must share identical seed values.

Per the plan's gating discipline (borrowed from `solutions/testing/2026-05-19-1132-gof-test-swap-effective-alpha-empirical-calibration.md`'s prevention strategy), any seed failure during conversion would have been treated as a candidate real bug rather than silently re-seeded. Empirically none of the 33 resulting test cases (11 blocks × 3 seeds) needed a substitution — every one passed on the canonical seed set on the first attempt. No `src/mc/*` production code was touched, matching the issue's explicit scope boundary.

## Prevention Strategy

When a statistical-test flakiness fix (unseeded or single-seed KS/chi-squared/Anderson-Darling test → fixed-seed sweep) is applied to one component in a shared test file, immediately grep the rest of that file for the same anti-pattern (a bare `.seed(N)` or no seed call adjacent to the same test-helper call) instead of stopping at the component that triggered the investigation. A targeted fix that isn't generalized into a file-wide policy just leaves siblings with the identical latent defect until a future contributor happens to notice — as happened here across two separate prior fixes before this pass closed the gap. Any new distributional test added to `test/mc.js` going forward must use the `SEEDS` sweep (or a documented sampler-specific variant) from the moment it is written, not as a later cleanup pass.

## Related Solutions

- `solutions/testing/2026-07-15-1044-ars-unseeded-ks-test-flake-fixed-seeds.md` — established the `[0, 42, 12345]` convention and diagnosed the root cause for ARS; this solution generalizes that fix file-wide.
- `solutions/testing/2026-07-15-2015-gibbs-conditionals-fresh-normal-seed-noop.md` — applied the same multi-seed-sweep convention to Gibbs, with its own `[0, 7, 42]` variant left intentionally unchanged by this pass.
- `solutions/testing/2026-05-19-1132-gof-test-swap-effective-alpha-empirical-calibration.md` — source of the empirical-verification-before-merging discipline applied here (treat a newly-failing seed as a candidate bug, not noise).

## Key Insight

When a statistical-test flakiness fix (unseeded/single-seed KS test → fixed-seed sweep) is applied to one sampler in a shared test file, audit every other call site of the same test helper in that file immediately — the fix is a file-wide policy, not a per-component patch, and leaving siblings undocumented just defers the same bug to a future issue.
