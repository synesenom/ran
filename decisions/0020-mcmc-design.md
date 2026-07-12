# ADR-0020: MCMC Base Class Accumulator Design and Subclass Contract

**Date**: 2026-07-11
**Status**: Accepted

## Context

PR #615 rewrote `src/mc/_mcmc.js` (then `mcmc.js`) but shipped without an ADR, even though the change touches a base class and its subclass contract — both are covered by the "when to write an ADR" rule in CLAUDE.md. This ADR captures the rationale after the fact for three decisions made in that rewrite:

1. Replacing the rolling-history closures (`history`, `acceptance`) with three online accumulators.
2. The three-method subclass contract (`_iter`, `_adjust`, `_internal`) that `RWM` implements and that future samplers (Gibbs, HMC, NUTS — see `todo.md`, issues #824/#825/#826) are expected to implement without base-class changes.
3. Tuning `samplingRate` during warm-up from the online autocorrelation estimate, including the 0.05 threshold.

## Decision

### 1. Online accumulators replace rolling-history closures

The pre-PR-615 design stored every observed state in a plain array per dimension (`history`), capped at `maxHistory` (default 10,000) by shifting the array (`Array.prototype.shift()`) once the cap was reached — an O(maxHistory) operation, paid on every iteration once the window is full, for O(n · maxHistory) of pure bookkeeping across n iterations. `statistics()` and `ac()` recomputed mean, variance, and lag-`r` autocorrelation by rescanning the entire stored window from scratch on every call: `ac()` ran a nested loop over `history_length × 100` lags, i.e. O(maxHistory) per call (the inner loop length was a hardcoded 100, independent of `maxHistory`), invoked once per warm-up batch (101 times for the `maxBatches = 100` default, since the loop runs `batch <= maxBatches`). None of this scales with the number of iterations beyond the fixed `maxHistory` cap — but that cap defaulted to 10,000, so every one of these O(maxHistory) operations carried a large constant factor that the new accumulators eliminate.

`_mcmc.js` replaces raw-history storage with three streaming accumulators, updated incrementally in `_updateAccumulators()`:

- **Welford's algorithm** (`_welford`, one `{n, mean, M2}` record per dimension) computes running mean and variance in O(1) per update and O(1) per `statistics()` call, and avoids the catastrophic cancellation that a naive `sum(x²)/n − mean²` variance formula suffers from.
- **Circular buffer + running cross-product sums** (`_acBuf`, `_acCross`) for autocorrelation. `_acBuf[d]` is a fixed-size `Float64Array(maxLag)` ring buffer of the most recent `maxLag` values; `_acCross[d][r]` accumulates `Σ x[i]·x[i−r]` as each new value arrives. `ac()` then only performs the O(maxLag) normalization per dimension, replacing the old O(maxHistory) full rescan per call with an O(dim × maxLag) query — since `maxLag` (100) is far smaller than the old `maxHistory` default (10,000), this is a large constant-factor reduction in a recurring per-call cost, not merely a re-derivation of the same bound. Memory drops from O(dim × maxHistory) raw samples to O(dim × maxLag) fixed-size typed arrays.
- **Plain counters** (`_accepted`, `_totalIter`) for acceptance rate, replacing a capped rolling array rebuilt via `reduce` on every `ar()` call.

`maxHistory` is replaced by `maxLag` (default 100) because the two configs answered different questions that had been conflated: `maxHistory` sized how much raw data was retained for statistics, while only the first `maxLag` entries of that data were ever read by `ac()`. Sizing the single retained buffer to what autocorrelation actually needs removes the wasted retention.

`sample()` calls `_initAccumulators()` before collecting samples, discarding whatever accumulator state accrued during `warmUp()`. This is necessary, not incidental: `warmUp()` runs the chain in a non-stationary regime while `_adjust()` is still tuning proposal parameters, so mean/variance/autocorrelation computed across the warm-up-to-sampling boundary would blend adaptation-phase and equilibrium-phase draws. Resetting at the start of `sample()` guarantees `statistics()` and `ar()`, once `sample()` has run, describe the sampling phase only.

### 2. Subclass contract: `_iter`, `_adjust`, `_internal`

Every subclass of `MCMC` must implement exactly three protected hooks; the base class throws `Error` if any is invoked without being overridden.

- **`_iter(x, warmUp)`** returns `{x, accepted}` for a single state transition. This captures the one operation every single-chain MCMC method must define, whatever its internal machinery: a Metropolis-Hastings accept/reject step (`RWM`), a full Gibbs sweep over conditional distributions (trivially `accepted: true`), or a leapfrog trajectory followed by a Hamiltonian accept/reject step (HMC/NUTS). The `warmUp` flag lets one method body branch on adaptation-specific behavior — `RWM._jump` currently uses it to choose single-dimension (Metropolis-within-Gibbs) proposals during warm-up versus joint proposals during sampling — without a second method.
- **`_adjust(iterResult)`** is called once per iteration, but only from `warmUp()`, giving the subclass a hook to update its own adaptive parameters: `RWM` runs batch Robbins-Monro step-size adaptation targeting a 0.44 per-component acceptance rate; HMC/NUTS would tune leapfrog step size and a mass-matrix diagonal here; a non-adaptive Gibbs sampler can no-op. Because the base class drives *when* `_adjust` runs (batching, scheduling, sampling-rate coupling), subclasses only implement *what* to do with one iteration's result — they do not duplicate warm-up control flow.
- **`_internal()`** returns whatever subclass-specific state must round-trip through `state()` so a serialized sampler can resume mid-chain — `RWM`'s current per-dimension proposal step sizes; HMC/NUTS's step size and mass matrix; a blocked Gibbs sampler's per-block state. This is the only point where subclass state crosses the `state()`/constructor boundary, which is why the base class's `state()` and constructor stay generic across every sampler family.

Because `dim`, `maxLag`, `samplingRate`, and the accumulators are already fully generic in the base class, and `_iter`/`_adjust`/`_internal` are the only places where "what does one step look like", "how do I adapt", and "what do I need to save" are algorithm-specific, no additional sampler family identified so far (Gibbs, HMC, NUTS) requires a fourth hook or a base-class change to fit the contract.

Gradient-based samplers (HMC, NUTS) additionally require `gradLogDensity(x)` — the gradient of the log target density — to compute leapfrog trajectories. This is passed as a constructor argument to the HMC/NUTS subclass itself (e.g. `new HMC(logDensity, gradLogDensity, config, initialState)`), not added to the `MCMC` base class constructor, because:

- Only gradient-based samplers need it; `RWM` and a prospective `Gibbs` sampler have no use for a gradient function, and widening the base constructor for every subclass to accommodate a parameter most of them ignore contradicts the base class's job of being the smallest common contract.
- `MCMC`'s constructor signature (`logDensity, config, initialState`) stays stable for every sampler family currently implemented or scoped (`RWM` shipped; Gibbs/HMC/NUTS scoped in `todo.md` under issues #824/#825/#826); extending it now for a family that does not exist yet would force unrelated subclasses and callers to route an unused parameter through.
- Subclass-specific constructor arguments are already how `RWM` differs from a hypothetical `Gibbs` sampler that might need per-block conditional samplers instead of a gradient; `gradLogDensity` is the same pattern applied to HMC/NUTS.

### 3. `samplingRate` tuning via autocorrelation, 0.05 threshold

`_thinningLag()` finds, across all dimensions, the largest first-lag at which `|autocorrelation| ≤ 0.05` — taking the max across dimensions because the slowest-mixing dimension determines the safe thinning interval for the whole chain. `_adjustSamplingRate()` then nudges `samplingRate` by ±1 per warm-up batch toward that lag, floored at 1.

Retaining every draw from a chain with strong short-lag autocorrelation would make `sample()`'s `size` samples look like `size` draws while actually containing far fewer effectively-independent observations, biasing downstream summaries (`statistics()`'s mean/variance) toward under-estimated variance of the estimator. Thinning to the point where autocorrelation has decayed to near zero produces closer-to-i.i.d. draws without requiring the caller to reason about the chain's mixing time themselves.

0.05 is a conventional "practically decorrelated" cutoff used in MCMC diagnostics: tight enough to bound the residual correlation retained after thinning, but not zero — an exact-zero requirement is never met on a finite online estimate (which carries its own sampling noise) and would push `samplingRate` toward `maxLag` unnecessarily. It is an engineering default, not derived from a target effective-sample-size formula; a future ADR can revisit it if a specific sampler family needs a different criterion, but it produces reasonable thinning intervals for `RWM` today.

The ±1-per-batch adjustment (rather than jumping straight to the estimated lag) exists because the accumulators are never reset between warm-up batches — `_thinningLag()` is evaluated over all iterations accumulated since the current `warmUp()` call began, while `_adjust()` is still changing the proposal underneath it. The process generating the chain is therefore non-stationary during warm-up, and the reported lag can shift meaningfully from one batch to the next as adaptation proceeds. A gradual step damps that oscillation instead of letting `samplingRate` jump on a lag estimate taken mid-adaptation.

## Consequences

**Easier:**
- `ac()` and `statistics()` cost O(dim × maxLag) and O(dim) respectively, independent of how long the chain has run — cheap enough to poll repeatedly (e.g. during warm-up progress reporting) without the cost growing with iteration count.
- Memory is bounded by `maxLag`, not by the number of iterations executed.
- Adding a new sampler family (Gibbs, HMC, NUTS) requires implementing `_iter`, `_adjust`, and `_internal` only — no changes to `MCMC` itself, and no widening of its constructor for gradient-based samplers specifically.
- `statistics()` and `ar()` cleanly separate warm-up-phase adaptation from sampling-phase results, because `sample()` resets the accumulators.

**Harder:**
- `ac()` at lag `r` needs at least `r + 1` observations since the last reset and returns `NaN` otherwise — callers must not read tail lags immediately after (re)initializing accumulators or restarting `sample()`.
- Raw sample values are no longer retained by the base class; any future diagnostic that needs the actual sequence of draws (not sufficient statistics) must consume the values returned by `sample()`/`iterate()` directly rather than reading them back off the accumulators.
- The 0.05 autocorrelation threshold and the ±1 sampling-rate step are hardcoded in the base class; a sampler family that needs a different thinning criterion would have to override `_thinningLag()`/`_adjustSamplingRate()` rather than configure them.
- `_internal()`'s returned key must match what the constructor reads back from `initialState.internal` — this is a naming contract between two methods that is not statically enforced. It was violated once already (see `solutions/correctness/2026-07-11-1230-mcmc-state-key-mismatch-silent-sigma-loss.md`) and remains a manual invariant subclass authors must maintain.
