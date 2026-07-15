---
date: 2026-07-15T10:44:00Z
category: "testing"
problem: "An unseeded KS-test-based distributional test for ran.mc.ARS flaked in CI at exactly the test's own significance-level false-positive rate"
status: complete
related_issue: "#820"
related_plan: "thoughts/plans/2026-07-15-0718-adaptive-rejection-sampling.md"
tags: [ks-test, seeded-tests, flaky-tests, statistical-tests, false-positive-rate, mc, ci-stability]
---

# Solution: Unseeded statistical tests flake at their own significance rate — sweep fixed seeds instead

**Date**: 2026-07-15T10:44:00Z
**Category**: testing
**Related Issue**: #820

## Problem

A KS-test-based distributional correctness test for `ran.mc.ARS`'s Normal(0,1) target was written unseeded — a single `sample()` call compared against `ksTest`. A full `npm test` run surfaced a real failure (`7809 passing / 1 failing`) that was not a correctness bug in the sampler: it was an unseeded PRNG draw landing on the wrong side of the KS test's own significance threshold. A 300-trial stress script confirmed an empirical failure rate of almost exactly 1.00% — matching the test's own `D <= 1.628/√N` critical value.

## Root Cause

A statistical hypothesis test (KS, chi-squared, Anderson-Darling, …) run once against an unseeded RNG is flaky *by definition*: at significance level α it will reject a true null hypothesis at rate α no matter how correct the code under test is. Treating one such failure as evidence of a real bug (or dismissing it as noise without acting) both waste time — the actual defect is that the test itself is non-deterministic, which is unacceptable for CI regardless of how "correct" the implementation is.

## Fix

Per direct instruction mid-session ("use multiple seeded tests instead of statistical tests"), all three ARS distributional tests (Normal, Gamma, Beta) were converted from one unseeded KS draw each to sweeping three fixed, pre-verified seeds (`[0, 42, 12345]` — the same set already used by `mc.RWM`'s `.seed()` tests) and running the identical KS check per seed. Each candidate seed was verified to pass before committing to it (via a throwaway script), so the fixed set is known-good rather than arbitrary. This makes the tests fully deterministic in CI: either all three seeds stay green forever, or a real regression breaks at least one of them reproducibly, instead of the whole block carrying a permanent ~1% per-run flake rate. Test count for that block grew from 3 to 9.

A related, second-order flaw was caught by a code-review pass on the seeded adaptive-envelope-tightening test: it compared `earlyRate = 50/(calls-c0)` against `laterRate = 3000/(calls-c1)` as a ratio, which could trivially pass via `Infinity >= Infinity` if a block happened to need zero extra evaluations (both denominators zero) — and it only swept a single seed. Fixed by counting extra evaluations directly (not as a ratio) and asserting concrete absolute (`laterExtraCalls / 3000 < 0.05`) and relative bounds, swept across the same three seeds.

## Prevention Strategy

Never ship a distributional/statistical test (KS, chi-squared, Anderson-Darling, or similar) driven by an unseeded PRNG — it will fail at its own significance-level rate independent of implementation correctness, and that rate compounds across every such test added to the suite over time. Always sweep a small, pre-verified, fixed set of seeds (reuse the existing project convention `[0, 42, 12345]`) so the outcome is deterministic in CI. Separately: when a test assertion is a *ratio* of two counters, explicitly guard the both-zero/both-infinite degenerate case, or restructure the assertion around raw counts instead of a derived ratio.

## Related Solutions

- `solutions/testing/2026-05-19-1132-gof-test-swap-effective-alpha-empirical-calibration.md` — a related but distinct lesson: nominal-α equivalence between two different GoF tests does not imply equivalent empirical flakiness; that solution's seed set `{0, 42, 12345}` is the same one reused here, confirming it as the project-wide convention for seeded statistical-test calibration.

## Key Insight

A statistical hypothesis test run against an unseeded PRNG is inherently flaky at its own significance-level rate — always sweep fixed, pre-verified seeds instead of trusting a single unseeded draw, and prefer asserting on raw counts over ratios that can degenerate to `Infinity >= Infinity`.
