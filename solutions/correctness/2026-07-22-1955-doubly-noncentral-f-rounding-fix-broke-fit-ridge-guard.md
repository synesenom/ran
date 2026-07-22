---
date: 2026-07-22T19:55:57Z
category: "correctness"
problem: "Fixing DoublyNoncentralF's internal/public d1-d2 rounding inconsistency broke the pre-existing #1063 fit() ridge-cost regression guard"
status: complete
related_issue: "#1084"
related_plan: "thoughts/plans/2026-07-22-1838-doubly-noncentral-f-rounding-consistency.md"
tags: [doubly-noncentral-f, doubly-noncentral-beta, fit, powell, likelihood-ridge, regression-guard-invalidation, empirical-verification, rounding, hinge-penalty]
---

# Solution: DoublyNoncentralF rounding fix broke the #1063 fit() ridge-cost regression guard

**Date**: 2026-07-22T19:55:57Z
**Category**: correctness
**Related Issue**: #1084

## Problem

`DoublyNoncentralF`'s constructor built its cached `DoublyNoncentralBeta` delegate — the object `pdf()`/`cdf()`/`sample()` actually compute against — from raw, un-rounded `d1`/`d2`, while `this.p` (what `.params()` reports, and what the class's own JSDoc promises: "If not an integer, it is rounded to the nearest one") stored the rounded integers. Three different representations of the same two parameters coexisted in one instance. This broke `save()`+`load()` round-trips for non-integer inputs and made `pdf()`/`cdf()`/`sample()` silently disagree with `.params()`.

## Root Cause

The obvious fix — round `d1`/`d2` once, at the very top of the constructor, exactly matching the already-correct pattern used by sibling classes `NoncentralF`/`DoublyNoncentralChi2` — had in fact already been tried once before, during a prior issue (#1070), and reverted, because `Distribution.fit()` calls `new Cls(...params)` on every single Powell trial evaluation. Rounding inside the constructor turns the log-likelihood surface into a piecewise-constant staircase in `d1`/`d2`, which defeats Powell's line search and roughly doubled the `_pdf` call count on `test/dist-base-fit-1.js`'s `#1063` regression guard (a deliberately family-mismatched `Rice(5,1)` dataset with a near-flat likelihood ridge, asserting `pdfCalls < 200000`).

The plan for this fix worked around that by giving `DoublyNoncentralF` its own `static fit()` that runs Powell against continuous `DoublyNoncentralBeta` trial instances directly (only rounding the final returned instance), reasoning that "the surface Powell explores stays exactly as smooth as it is today, so the #1063 ceiling needs no re-tuning." **That assumption was false**, and could only be discovered by direct empirical A/B measurement (`git stash` comparing old vs. new `_pdf`): the *pre-fix buggy* `_pdf` — a rounded transform-scale `n = d1/d2` multiplying a raw/continuous Beta density — was itself an accidental numerical stabilizer that happened to keep Powell's search bounded on the `#1063` ridge dataset. Once `_pdf`'s transform and its underlying density both used the *same* consistent representation (continuous, in the first attempt), the objective became a genuinely smoother, more literally-correct surface — and Powell's bracket-expansion line search chased the ridge much further before the tolerance-based stopping criterion engaged (`d2` walked to ~8.1M, `lambda2` to ~39,545, 113s vs. a 40s test timeout). A second candidate (round early, inherit the base `Distribution.fit()` so every trial constructs a rounding `DoublyNoncentralF`) was also tested and also failed differently (294,000 `_pdf` calls, over the ceiling) — a piecewise-constant surface is just as bad for Powell as a smoother-but-unbounded one on this particular ridge.

## Fix

Round `d1`/`d2` once at the top of the constructor (matching `NoncentralF`/`DoublyNoncentralChi2`), and give `DoublyNoncentralF` its own `static fit()` (`src/dist/doubly-noncentral-f.js`) that searches continuous `DoublyNoncentralBeta` space with a **smooth squared-hinge penalty** added to the objective — zero inside a plausible region, quadratic beyond it, never fully excluding any finite parameter value. A hard per-dimension plausibility ceiling (reject trial params beyond 50× the `_fitInit` guess) was proposed by a `recovery-fix` agent and explicitly rejected during `recovery-validate`: an `Infinity` cutoff reintroduces exactly the kind of discontinuity that sank the original naive-rounding fix, and risks silently underfitting real large-parameter data with zero warning. The final penalty uses two different reference-scale mechanisms for a documented reason: `d1`/`d2` are penalized relative to the `_fitInit` moment-matching guess (log-ratio hinge, safe since that estimator is reliable), but `lambda1`/`lambda2` are penalized relative to an *absolute, algorithm-derived* threshold (`2 * MAX_ITER`, the point past which `DoublyNoncentralBeta`'s Poisson-mixing summation index is capped anyway) rather than the `_fitInit` guess — because `_fitInit`'s lambda estimate floors at `1e-3` whenever the moment-matched value is non-positive (common even for well-matched, modest-lambda data), and a log-ratio-vs-guess formulation for lambda was tried first and broke an unrelated, previously-passing test (the generic `[3,8,1,1]` fit-recovery case in `test/dist-cases-continuous.js`) before the absolute-threshold reformulation fixed both.

## Prevention Strategy

When a bug fix changes a computation from "internally inconsistent/buggy" to "internally consistent/correct," **do not assume a downstream performance or regression-test calibration is preserved just because the code path or Big-O shape looks unchanged.** A regression guard's numeric ceiling (call count, iteration bound, timeout) was calibrated against the codebase *as it existed at calibration time* — including any other bugs present then. If the current fix touches the same function whose buggy behavior the guard was calibrated against (even indirectly — here, the transform and the density it multiplies), treat "does the ceiling still hold" as an open empirical question, not a corollary of "the search space is still smooth." Concretely: before landing a fix that changes a computation feeding into a pre-existing optimizer/loop-bound regression test, run that specific test (or an isolated A/B via `git stash`) against both the old and new code *before* claiming the ceiling is untouched in the plan — a plausible verbal argument about "surface smoothness" is not a substitute for measurement, especially when an optimizer's stopping behavior depends on the exact numerical trajectory it explores, not just the qualitative shape of the objective.

When adding a barrier/penalty to keep an optimizer off a known-pathological region, prefer a smooth hinge (zero in a plausible region, growing continuously beyond it) over a hard cutoff — a hard `Infinity` threshold reintroduces the same "discontinuity defeats Brent's parabolic interpolation" failure mode that a naive-rounding fix already demonstrated, and can silently exclude legitimate distant optima with no error signal. When choosing the barrier's reference scale, verify the reference estimator itself is reliable across the *intended* parameter's typical range — an estimator that floors near a boundary (as this codebase's `_fitInit` does for `lambda`) makes a relative/log-ratio penalty anchored to it punish ordinary values, not just pathological ones; an absolute, algorithm-derived threshold (tied to a real numerical-cost cliff like an iteration cap) avoids that trap.

## Related Solutions

- `solutions/performance/2026-07-22-0702-doubly-noncentral-fit-powell-ridge-cost.md` — the original `#1063` root-cause writeup, which established the same higher-order lesson one level down: "always empirically re-verify a fix against the original, exact reproduction... a plausible-sounding root cause... is a hypothesis until it's checked against measured behavior, not a conclusion." This solution recurs that lesson one level up — a confident *prevention* claim ("this fix leaves that other guard alone") needs the same empirical discipline as a confident diagnosis.
- `decisions/0017-beta-fit-penalty.md` — precedent for using a smooth log-barrier penalty (rather than a hard cutoff) to repel Powell from a boundary singularity in Beta-family fits; this fix's squared-hinge penalty is a variant of the same idea, applied to a "too far from plausible" region instead of a domain boundary.

## Key Insight

A buggy computation can accidentally double as a numerical stabilizer for an unrelated optimizer-based regression test; fixing the bug can therefore *break* that test even when the fix's surface-level reasoning ("the search space stays equally smooth") sounds airtight — always A/B-measure a pre-existing optimizer-loop regression guard against old vs. new code before assuming it's unaffected, rather than reasoning about it in the abstract.
