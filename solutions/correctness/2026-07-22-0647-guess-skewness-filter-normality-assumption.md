---
date: 2026-07-22T06:47:51Z
category: "correctness"
problem: "ran.dist.guess()'s soft skewness filter borrowed a normal-only variance constant and silently applied it to every SYMMETRIC family, over-excluding heavy-tailed Laplace"
status: complete
related_issue: "#1064"
related_plan: "thoughts/plans/2026-07-21-1936-skewness-filter-calibration.md"
tags: [guess, skewness, soft-filter, asymptotic-variance, normality-assumption, model-selection, monte-carlo-validation]
---

# Solution: Calibrate guess()'s skewness filter per SYMMETRIC family instead of a shared normal-only threshold

**Date**: 2026-07-22T06:47:51Z
**Category**: correctness
**Related Issue**: #1064

## Problem

`ran.dist.guess()`'s soft skewness pre-filter excludes `SYMMETRIC`-family candidates (`Normal`, `Uniform`, `Laplace`) whose sample skewness magnitude exceeds a threshold, before the expensive `fit()` call runs. The threshold was a single shared formula, `2·√(6/n)`, applied identically to all three families. Monte Carlo validation (`scripts/guess-filter-validation.js`, 10,000 seeded draws per configuration, n = 50..1000; see issue #1054) measured the intended ~5% false-exclusion rate for `Normal` (4.2%-4.7%) but 34.7%-51.1% for `Laplace` — `guess()` was wrongly discarding the correct `Laplace` candidate on 1-in-3-to-1-in-2 calls against genuinely Laplace-distributed data, a silent usability defect in a public API with no diagnostic surfaced to the caller (soft filters exclude without a trace, by design — see `guess.js`'s own filter-design comment).

## Root Cause

`6/n` is the asymptotic variance of the Fisher-Pearson sample skewness estimator `g1` **specifically under the assumption that the population is normal** (the classical Bowman-Shenton result). The code treated this normal-derived constant as if it were a property of the category "symmetric distribution" in general, when it is actually a property of the *shape of the tails* specifically. `Laplace`'s excess kurtosis (3, vs. Normal's 0) inflates the general (non-normal) asymptotic variance formula, `Var(g1)·n ≈ μ6/μ2³ − 6·μ4/μ2² + 9` (population central moments), to ~63 — a ~10.5× inflation over Normal's 6, requiring a ~3.2× wider threshold to hold the false-exclusion rate constant. A formula derived under one member's special-case assumption was silently generalized to every member of a curated name-set (`SYMMETRIC` in `src/dist/_guess-meta.js`) without checking whether the assumption that produced it (normality) actually held for the other members.

## Fix

Derived the exact `Var(g1)·n` constant analytically for each of the three `SYMMETRIC` families from their known population moments — `Normal → 6`, `Uniform → 72/35`, `Laplace → 63` — all scale/location-invariant, so one constant per family suffices regardless of parameterization. Changed `SYMMETRIC` in `src/dist/_guess-meta.js` from `Set<string>` to `Map<string, number>` keyed by family name, and moved the threshold computation in `src/dist/guess.js` from a single value precomputed once per `guess()` call (in `_dataContext`) to a per-candidate lookup inside `_skewnessFilterFails(name, skew, n)`. `scripts/guess-filter-validation.js` was updated to mirror the per-family formula and gained a `Uniform(-1,1)` config entry (previously untested, despite being a `SYMMETRIC` member). Post-fix measured rates: `Normal` 4.2%-4.7% (unchanged), `Uniform` 4.4%-5.6% (safe, and now actually measured rather than assumed), `Laplace` 1.4%-4.2% (down from 34.7%-51.1%).

Two alternatives were explicitly considered and rejected via an independent design-propose/design-critique agent pair (both converged at high confidence on the chosen fix):
- **Sample-based kurtosis plug-in** (`Var(g1)·n ≈ 6·(1 + kappa/2)` using the already-implemented `src/shape/kurtosis.js`): rejected because the first-order approximation only yields ~15 for Laplace (kappa=3) vs. the true 63 — a 4× underestimate that would not have actually fixed the false-exclusion rate, plus it introduces real estimator noise from the 6th-moment-dominated tail behavior that a first-order kurtosis term cannot capture.
- **Removing Laplace from `SYMMETRIC` entirely** (the issue's own "option b", and consistent with `_guess-meta.js`'s stated design that an untagged distribution "simply receives no soft filter... never a correctness problem"): a valid, simpler fallback, but permanently forfeits the pruning benefit for Laplace and sets a precedent of descoping rather than calibrating when a family is "hard."

## Prevention Strategy

Whenever a statistical threshold or bound is derived under a simplifying distributional assumption (normality, homoscedasticity, light tails, etc.) and then applied uniformly across a *set* of items that only share a superficial property — here, "symmetric skewness sign" — explicitly check whether the assumption that produced the constant holds for **every** member of the set. A shared category label does not imply a shared numeric constant. For estimator-variance-based thresholds specifically: when family membership is already known at filter-design time (as with a curated, hand-maintained set like `_guess-meta.js`'s `SYMMETRIC`), prefer computing each family's exact asymptotic variance analytically from population moments over a sample-based plug-in — it is exact, has zero estimation noise, and the moment-derivation formula (`Var(g1)·n ≈ μ6/μ2³ − 6·μ4/μ2² + 9`) is a standard, checkable result. Reserve sample-based/data-driven estimates for cases where family membership is genuinely unknown at design time. Any such heuristic needs a Monte Carlo validation harness run **per family member**, not just for one representative — a passing rate for `Normal` alone said nothing about `Laplace` or `Uniform` sharing the same code path, and `Uniform` had gone completely unmeasured despite being in scope the whole time.

## Related Solutions

- `solutions/testing/2026-07-21-1131-wald-ci-degenerate-at-zero-wilson-score-fix.md` — the same validation script's confidence-interval methodology; this fix's empirical confirmation step relies on that prior correctness fix to trust near-zero measured rates.
- `solutions/testing/2026-07-21-1055-guess-default-pool-latent-fit-cliff.md` and `solutions/distribution/2026-07-20-2359-guess-probe-instance-pre-fit-introspection.md` — earlier `guess()` design background (probe-based introspection, default-pool fit-cost cliffs); neither addressed skewness calibration directly, but both establish the surrounding pre-filter architecture this fix operates within.

## Key Insight

A statistical formula borrowed from one distribution's asymptotic theory (`Var(g1) = 6/n` under normality) does not generalize to other members of a "similar" category just because they share a superficial property like symmetry — always re-derive or empirically re-validate distribution-dependent constants per family rather than silently reusing one across a named group.
