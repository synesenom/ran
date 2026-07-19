---
date: 2026-07-19T12:50:25Z
category: "correctness"
problem: "Porting a Euclidean metric to NUTS: the no-U-turn check must use the velocity M⁻¹r, not the raw momentum r"
status: complete
related_issue: "#1035"
related_plan: "thoughts/plans/2026-07-19-1015-nuts-euclidean-metric-adaptation.md"
tags: [nuts, hmc, mcmc, metric, mass-matrix, no-u-turn, velocity, momentum, ess, kolmogorov-smirnov, invariance, betancourt, leapfrog]
---

# Solution: NUTS no-U-turn criterion must dot velocity M⁻¹r, not raw momentum r

**Date**: 2026-07-19T12:50:25Z
**Category**: correctness
**Related Issue**: #1035

## Problem

`ran.mc.NUTS` used a fixed identity mass matrix, mixing worse than `ran.mc.HMC`
on poorly-scaled or correlated targets (a documented capability gap). Porting
HMC's Euclidean metric adaptation (diagonal + dense mass matrices, ADR-0029) to
NUTS meant generalizing every place NUTS implicitly assumed momentum and velocity
are the same vector — true only under the identity metric. The trap: a naive port
that keeps the no-U-turn stopping criterion dotting the trajectory span against
the raw momentum `r` produces the **correct target distribution** and passes every
KS test, while silently degrading efficiency on ill-scaled targets.

## Root Cause

NUTS's no-U-turn criterion dots the trajectory span `(x⁺ − x⁻)` against a
momentum-like quantity to decide whether the doubling tree has curved back on
itself. Under an identity mass matrix, momentum `r` and velocity `M⁻¹r` are
numerically identical, so keeping raw momentum "just works." Once `M` is a genuine
non-identity adapted metric, the two diverge, and the mathematically correct
criterion (Betancourt 2017; Stan's `adapt_diag_e_nuts`/`adapt_dense_e_nuts`)
requires the **velocity** `M⁻¹r`.

The failure is invisible to distributional tests because **NUTS's stationary
distribution is invariant under any consistent positive-definite metric** — only
mixing efficiency depends on the metric. A build that dots raw momentum still
targets the right distribution (KS/chi-squared pass), but mis-tunes trajectory
length (the tree over- or under-extends), lowering effective sample size with no
crash and no distributional failure.

A second, related subtlety: the same invariance means a KS test can only catch an
*inconsistent* use of `M` vs `M⁻¹` across code paths (e.g. `_sampleMomentum`
disagreeing with `_applyInverseMetric`). A *systematically swapped but internally
consistent* `M`/`M⁻¹` (a valid, merely inefficient metric) preserves detailed
balance and is invisible to any distributional test — only an efficiency (ESS)
check catches it.

## Fix

- Threaded endpoint velocities (`velMinus`/`velPlus`) through the whole
  doubling-tree recursion (`_growTree`, `_buildTreeLeaf`, `_buildTreeBranch`,
  `_combineSubtrees`) alongside the existing momentum fields, and changed
  `_noUTurn` to dot `(x⁺ − x⁻)` against velocity.
- Gave NUTS its own inline metric-aware `_leapfrog` (replacing the deleted shared
  `src/mc/_leapfrog.js`) that returns `{ x, r, vel }`. The endpoint velocity is
  already computed for the position update, so returning it **caches** `M⁻¹r`
  rather than recomputing it at each U-turn check — ~10x fewer `M⁻¹r` evaluations
  than on-demand recomputation (a leaf's velocity is read at every ancestor level).
- Two regression guards: (1) a targeted unit test on `NUTS._noUTurn` with inputs
  engineered so the raw-momentum and velocity verdicts *disagree* (dx·r ≥ 0 but
  dx·(M⁻¹r) < 0), isolating the formula rather than its statistical shadow; (2) an
  ESS-balance test with **absolute** (not relative) bounds comparing diagonal-metric
  vs. identity-metric mixing on a deliberately ill-scaled 10-D target.
- The diagonal-identity default (`variance = [1,…]`) keeps `_sampleMomentum`
  (`z/√1`), `_applyInverseMetric` (`p·1`), and the U-turn dot bitwise-identical to
  the pre-metric sampler, preserving seed reproducibility.

## Prevention Strategy

When a sampler's **correctness invariant** (stationary distribution) is decoupled
from its **efficiency invariant** (mixing/ESS), a distributional test is *not* a
sufficient regression guard for a metric/velocity-vs-momentum bug. General rule
for porting HMC-family machinery to a new sampler: any quantity used only in its
identity-metric special case (where momentum ≈ velocity, `r` ≈ `M⁻¹r`) must be
re-derived for the general metric and verified by a test that can **distinguish**
the two forms — a direct unit test on the criterion, or an ESS-efficiency
comparison on an ill-scaled target — not merely a test that checks the output
distribution is still correct.

## Related Solutions

- `solutions/correctness/2026-07-16-1422-hmc-mass-matrix-precision-inversion.md` —
  the sibling M-vs-M⁻¹ precision-convention trap in HMC (`M = Σ⁻¹`).
- `solutions/testing/2026-07-16-1417-nuts-hmc-ess-comparison-target-choice.md` —
  ESS-comparison tests are target-choice-sensitive; a poorly-chosen target fails
  to exercise the advantage being tested.

## Key Insight

Under a non-identity mass matrix, NUTS's no-U-turn check must dot the span with
the velocity `M⁻¹r`, not the raw momentum `r`; the two coincide (hiding the bug)
only in the identity case, so KS tests cannot detect the swap — only a direct unit
test on the stopping criterion or an ESS comparison on an ill-scaled target can.
