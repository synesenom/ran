---
date: 2026-07-16T14:22:34Z
category: "correctness"
problem: "HMC mass matrix M and its inverse M⁻¹ were swapped in the initial Euclidean metric adaptation implementation"
status: complete
related_issue: "#826"
related_plan: "thoughts/plans/2026-07-16-0958-euclidean-metric-adaptation-hmc.md"
tags: [hmc, mass-matrix, precision-matrix, mcmc, numerical-correctness, ess, test-methodology]
---

# Solution: HMC mass matrix M and M⁻¹ were swapped in the initial Euclidean metric adaptation implementation

**Date**: 2026-07-16T14:22:34Z
**Category**: correctness
**Related Issue**: #826

## Problem

`HMC` (`src/mc/hmc.js`) previously used an implicit identity mass matrix (momenta `~ N(0,I)`, leapfrog position update `x + eps*r`), which made it unable to efficiently sample targets whose parameters have very different scales or strong correlations. Issue #826 asked for Euclidean metric (mass-matrix) adaptation: estimate `M = Cov(θ)⁻¹` online during warm-up and use it in momentum resampling (`p ~ N(0,M)`) and the kinetic energy (`½pᵀM⁻¹p`).

The first working version of `_sampleMomentum`/`_applyInverseMetric`/`_kineticEnergy` had `M` and `M⁻¹` inverted: it sampled momentum with `std = sqrt(variance)` (should be `1/sqrt(variance)`, i.e. drawn from the precision) and computed `M⁻¹p` by dividing by the estimated variance (should multiply by the covariance/variance). The code ran without errors and passed a superficial sanity check — it even looked correct on a small-variance test dimension by coincidence. On the large-variance dimension of a `sigma = [1, 100, 0.1]` test target, the estimated variance converged to ~63 instead of ~10000, and the per-dimension ESS was imbalanced in the *opposite* direction from what metric adaptation is supposed to produce.

## Root Cause

`M⁻¹` and `M` were swapped because it's easy to lose track of which matrix is "the metric" once you go from Neal/Stan's abstract notation (`M = Cov(θ)⁻¹`, i.e. `M` is the *precision*) to code where the thing actually estimated online is the sample covariance/variance `Σ` itself, not its inverse. A variable holding `Σ` (estimated variance) was used as if it were `M` (precision) in one place and as if it were `M⁻¹` (`= Σ`) in another, and both directions "look" plausible in isolation — dividing by variance and multiplying by variance are both common, legitimate-looking operations in mass-matrix code.

Deriving the correct relationship from Hamilton's equations for a Gaussian target: `H(θ,p) = U(θ) + ½pᵀM⁻¹p`, `dθ/dt = M⁻¹p`, `dp/dt = -∂U/∂θ`. For `U(θ) = θᵀΣ⁻¹θ/2` (target covariance `Σ`), this gives `d²θ/dt² = -M⁻¹Σ⁻¹θ`, which only reduces to the "nice" unit-frequency oscillator (`d²θ/dt² = -θ`, matching the `Σ=M=I` case) when `M⁻¹ = Σ`, i.e. `M = Σ⁻¹`. This confirms the issue's own `M = Cov(θ)⁻¹` specification — but nothing in the design-review/ADR phase caught the implementation flipping the direction, because the ADR correctly stated the math while the *code* is where the inversion got reversed, and no test asserted empirical variance or sampled-distribution correctness against ground truth until an ad-hoc debug script did.

Static reasoning, code review by a design-propose/design-critique pair, and an independent correctness-review agent's *manual re-derivation* of the same algebra all initially/eventually caught different parts of this — but the bug was only *found* empirically, by writing a throwaway debug script that compared the sampler's empirical per-dimension variance against the target's known true variance.

## Fix

Re-derived Hamilton's equations from scratch to pin down the correct direction, then corrected the three methods in `src/mc/hmc.js`:
- **Momentum sampling** (`_sampleMomentum`) draws from the **precision**: diagonal case `p_i = z_i / sqrt(variance_i)`; dense case solves `Lᵀp = z/sqrt(D)` via back-substitution against the LDL factors of the estimated *covariance* `Σ = LDLᵀ`.
- **`M⁻¹p`** (`_applyInverseMetric`, used in both the leapfrog position update and the kinetic energy) **multiplies** by the covariance/variance directly: diagonal `p_i * variance_i`; dense `L·D·Lᵀ·p` — three plain matrix-vector products, no triangular solve needed here (only momentum sampling draws from the precision and needs the solve).

Two guard tests were added specifically because ESS/mixing diagnostics alone did not catch this bug:
- A **KS test** on the sampled margins against the known analytical Normal, for both the diagonal and dense metric paths — this directly catches a sign/inversion bug that would silently bias the sampled distribution while still appearing to "improve" an ESS-style mixing diagnostic.
- An **ESS-balance test** comparing adapted vs. unadapted per-dimension ESS ratios (the acceptance criterion from #826 itself).

A related, smaller methodology bug surfaced while writing the dense-vs-diagonal ESS comparison test: it initially reported the wrong-direction result because the two HMC configurations auto-tune different `samplingRate` (thinning) values, and the existing codebase convention `ess(sampler, samplingRate * sampleSize.length)` implicitly compares each sampler's ESS over a *different* raw-iteration budget whenever their thinning diverges. Fixed by resetting accumulators via `sample(null, 0)` and driving a fixed raw-iteration count via manual `iterate()` calls instead of trusting the sampler's own thinning-derived budget. The same confound may affect the pre-existing `AdaptiveMetropolis` vs `RWM` ESS comparison test in `test/mc.js` if those two samplers ever end up with sufficiently different auto-tuned `samplingRate` on some target — flagged separately as issue #975 (which covers a related but distinct bug: the shared `ess()` helper's naive lag-truncation rule).

## Prevention Strategy

For any mass-matrix/precision-matrix implementation (or more generally, any code where a "quantity vs. its inverse" relationship is load-bearing), add a numeric ground-truth test *before* trusting an ESS/mixing-efficiency diagnostic: assert the empirical per-dimension variance (or run a KS test against the known analytical margins) matches the target's true, independently-known moments. ESS/acceptance-rate/mixing diagnostics can look "better" even under a swapped-inverse bug — they measure *how efficiently* a chain explores, not *whether it's exploring the right distribution* — so they must never be the only correctness check for a change that touches which matrix vs. its inverse is applied where. Always pair a mixing-efficiency test with a distributional-correctness test.

Separately: when comparing per-dimension ESS/mixing between two adaptive samplers that may auto-tune different thinning (`samplingRate`), always fix a common raw-iteration budget (reset accumulators, call `iterate()` manually) rather than reusing the `samplingRate * sampleSize.length` convention, which silently compares different budgets when the two samplers' thinning diverges.

## Related Solutions

- `solutions/correctness/2026-07-15-1230-hmc-resumed-internal-state-validation-gap.md` — another HMC correctness gap (resumed `initialState.internal` fields bypassing validation), same file, different bug class.
- Issue #975 (filed this session) — the shared `ess()` test helper's naive lag-truncation rule, a related but distinct ESS-measurement bug discovered while debugging the dense-vs-diagonal comparison test above.

## Key Insight

When code estimates a covariance/variance `Σ` but the algorithm's math is phrased in terms of the precision matrix `M = Σ⁻¹`, a swapped `M`/`M⁻¹` bug produces code that runs, looks plausible, and can even improve a mixing-efficiency diagnostic (ESS) while silently sampling from the wrong distribution — so any mass-matrix (or similar inverse-relationship) implementation needs a distributional ground-truth test (KS test against known analytical margins, or empirical variance vs. true variance), not just an ESS/acceptance-rate check, to catch it.
