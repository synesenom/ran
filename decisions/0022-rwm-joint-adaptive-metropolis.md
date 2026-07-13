# ADR-0022: RWM Uses Joint Adaptive Metropolis in Both Phases

**Date**: 2026-07-13
**Status**: Accepted

## Context

`RWM` (`src/mc/rwm.js`) ran two different proposal mechanisms depending on phase, described as an intentional example in ADR-0020 §2:

- **Warm-up**: Metropolis-within-Gibbs. `_jump` perturbed a single component per step (held fixed in batches of 100), and `_updateProposal` adapted that component's log step size via batch Robbins-Monro toward a **0.44 per-component** acceptance rate (the Roberts & Rosenthal 2009 adaptive-MwG target).
- **Sampling**: joint. `_jump` perturbed every component at once using the per-component scales tuned above.

For `dim = 1` the two coincide, so the shipped, tested behavior was correct. For `dim > 1` they are inconsistent in two compounding ways:

1. **The tuning target does not match the sampling proposal.** Each `_sigma[i]` was tuned so that perturbing *component i alone* accepts 44% of the time. Sampling then perturbs *all components jointly*. A joint proposal built from per-component-optimal scales accepts far below the joint optimum (the optimal joint scaling is ~2.38/√d per component with a 0.234 acceptance rate in the high-dimensional limit — Roberts, Gelman & Gilks 1997), so the sampler is mistuned exactly where tuning matters.
2. **Warm-up autocorrelation measures the wrong chain.** `_thinningLag()` (which sets `samplingRate`) was computed over the warm-up chain, where each component is frozen for long stretches — an autocorrelation structure unrelated to the every-step joint moves used during sampling.

The class is named **RWM — Random Walk Metropolis**, whose canonical form *is* a joint Gaussian proposal. The two-phase split was an implementation artifact, not a property of the algorithm the class advertises.

## Decision

`RWM` uses a single, consistent **joint diagonal adaptive Metropolis** proposal in both warm-up and sampling.

- **Proposal (both phases)**: `x' = x + exp(_ls) · (base ⊙ Z)`, `Z ~ N(0, I)`, where `_ls` is a scalar global log step scale and `base[i]` is the per-component base scale. Every component is perturbed on every step.
- **Global scale adaptation (warm-up only)**: after each batch of 100 joint proposals, nudge `_ls` by `±δ` with `δ = min(0.01, batch^{-1/2})` (the Roberts & Rosenthal 2009 diminishing-adaptation schedule) toward the optimal acceptance rate — `0.44` for `dim = 1`, `0.234` for `dim > 1`. A single joint accept/reject cannot attribute acceptance to individual components, so only the shared global scale is adapted from acceptance.
- **Per-component scaling (warm-up only)**: `base[i]` tracks the running marginal standard deviation of component `i`, read from the base class's Welford accumulator via `statistics()`. This is the diagonal of the empirical target covariance — the Haario, Saksman & Tamminen (2001) adaptive-Metropolis idea restricted to the diagonal — and keeps heterogeneous marginals well scaled without estimating a full covariance matrix or a Cholesky factor per step. A component with a not-yet-positive spread estimate (`n ≤ 1`) keeps its seeded base rather than collapsing to a point mass.
- **Frozen during sampling**: `_adjust` is called only from `warmUp()`, so `_ls` and `base` are fixed once sampling starts. Adaptation happens entirely in warm-up; the sampling phase is an ordinary fixed-proposal Metropolis chain, which sidesteps the adaptive-MCMC ergodicity caveats (the diminishing-adaptation conditions only need to hold during adaptation).
- **State**: `_internal()` serializes the *effective* per-component std, `base[i] · exp(_ls)`, so a resumed sampler reproduces the same joint proposal directly (it sets `base` to that value with `_ls = 0`).

This refines the specific two-phase example in ADR-0020 §2; the rest of ADR-0020 (accumulator design, the `_iter`/`_adjust`/`_internal` contract, reset-on-`sample()`) is unchanged. The 0.44-target Metropolis-within-Gibbs scheme is no longer used by `RWM`.

Why not the alternatives:

- **Componentwise sampling (keep MwG, sample one component per step)** is equally consistent and would have kept per-component scales learnable from acceptance, but it makes the class a componentwise sampler rather than the random-walk Metropolis its name and public documentation promise, and it forces `samplingRate ≥ dim` just to complete one sweep per recorded draw.
- **Full adaptive Metropolis (estimate the entire target covariance)** is the most statistically powerful joint scheme but needs an online covariance estimate plus a per-step Cholesky/factorization; the diagonal approximation captures per-marginal scale — the dominant effect for the low-to-moderate dimensions this library targets — at a fraction of the cost and code. Full-covariance AM can be added later as its own sampler without disturbing this contract.

### Acceptance-rate accounting after the switch to joint proposals

Making the proposal joint changed RWM's private tuning tracker (`_pAccepted`/`_pN`) from a **per-dimension** array (one acceptance count per component under the old Metropolis-within-Gibbs scheme) into a **single pooled** batch counter. ADR-0021 §"RWM's internal tracker stays separate" justified keeping that tracker distinct from the base class's windowed `ar()` accumulator on the grounds that the two operate "at different granularity (per-dimension vs. pooled)." **That rationale no longer holds** — both are now pooled. This ADR records the corrected justification and the resulting cleanup:

- **The RWM tuner stays separate from `ar()`, for different reasons than ADR-0021 gave.** The tuner needs the acceptance rate over the **last 100 proposals, in non-overlapping batches that reset each batch**, so the Robbins-Monro batch index advances on independent data; `ar()` reports a **1000-wide sliding** window for a smooth user-facing diagnostic. The remaining reasons to keep them separate are therefore cadence, non-overlapping-vs-sliding reset semantics, and *decoupling the tuner from the user-configurable `arWindow`* — a user widening the diagnostic window must not perturb the sampler's adaptation dynamics (the hazard ADR-0021 itself flagged). Granularity is no longer among the reasons.
- **The base class's retained cumulative counters (`_accepted`/`_totalIter`) are removed.** ADR-0021 kept them as write-only private state to "leave the door open for a future all-time diagnostic without another design pass." With `ar()` windowed and the RWM tuner batched, nothing reads them; they are written on every iteration and never consumed. Retaining write-only state for a diagnostic that does not exist is speculative generality of exactly the kind ADR-0020/0021 reject for sampler families ("base-class-only when a second family demonstrates the need") — and re-adding an all-time rate later is a three-line change (init, increment, accessor), not a design pass. This revises ADR-0021's "Cumulative counters retained" point; the windowed-`ar()` decision that is ADR-0021's actual subject is unchanged.
- **No generic adaptation machinery is hoisted into `MCMC`.** The base class already owns the accept/reject-agnostic accounting behind `ar()`; the adaptation *policy* (target rate, Robbins-Monro schedule, what is scaled) is sampler-specific — HMC/NUTS target ≈0.65/0.8 via Nesterov dual-averaging, Gibbs has no accept/reject — and stays in `_adjust`. A shared "batched acceptance signal + dual-averaging" helper should be extracted only when a second sampler family makes the common shape observable, not invented speculatively from a single subclass.

## Consequences

**Easier:**
- Warm-up tunes the exact proposal that sampling uses, so `samplingRate` (driven by warm-up autocorrelation) now reflects the sampling chain, and the acceptance rate the tuner targets is the rate the sampler actually achieves.
- `RWM` matches the textbook Random Walk Metropolis its name advertises; the adaptation is standard diagonal adaptive Metropolis with published convergence backing.
- Per-component base scales adapt to heterogeneous marginal spreads instead of every component being tuned to the same 1-D optimum then used jointly.

**Harder:**
- Per-component scales are learned from the marginal *variances*, not from per-component acceptance, so strongly correlated targets (where off-diagonal covariance matters) are scaled only by their marginals — a full-covariance adaptive sampler would mix better there. This is the accepted cost of a diagonal proposal.
- `0.234` is applied for every `dim > 1`; the intermediate-dimension optima (d=2 ≈ 0.35, d=3 ≈ 0.28) are approximated by the high-dimensional limit rather than targeted exactly.
- `_base` depends on `statistics()`, coupling the proposal to the Welford accumulator; a future change to when those accumulators reset must account for warm-up's dependence on them.
