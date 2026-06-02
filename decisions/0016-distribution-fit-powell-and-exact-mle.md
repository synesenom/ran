# ADR-0016: Distribution.fit() — Powell Optimizer + Closed-Form MLE Fast Path

**Date**: 2026-06-01
**Status**: Accepted

Supersedes [ADR-0012](0012-distribution-fit-nelder-mead.md) (Nelder-Mead for `fit()`).

## Context

`Distribution.fit(data)` (ADR-0012) maximised the log-likelihood with the Nelder-Mead simplex
method, seeded by `_fitInit`. Issue #546 asked to improve convergence and accuracy. Investigating
it surfaced three facts that reshaped the change:

1. **Machine precision is the wrong target for a generic optimizer.** Near an interior optimum the
   log-likelihood is locally quadratic, so any method that searches on *function values*
   (Nelder-Mead, Powell, L-BFGS with finite-difference gradients) can locate the minimiser only to
   `≈ √(ε_f / H)` — the well-known √EPS barrier (Nocedal & Wright, *Numerical Optimization* §8.1).
   With the special-function/quadrature noise floor here (`ε_f ~ 1e-12`) that is `~1e-8` at best.
   The `1e-14` precision goal is reachable **only** by evaluating a closed-form MLE directly, not by
   any iterative optimizer. (Statistical error in the estimate is separately `O(1/√n)` and dwarfs
   both — it is a property of the data, not the algorithm.)

2. **A gradient-based method (the literal ask in #546) is inappropriate here.** The `fit()`
   objective is an `Infinity` barrier (invalid parameters → `Infinity`), and several likelihoods
   are discontinuous or non-differentiable in their parameters (Uniform/Triangular/Bates support
   endpoints; ordering constraints `a < b`; the Categorical simplex). Central finite-difference
   gradients produce `NaN`/`Infinity` at these boundaries, and box constraints (L-BFGS-B) cannot
   even express ordering or simplex constraints. A derivative-free method is required.

3. **For many distributions `_fitInit` already *is* the exact MLE**, and Nelder-Mead was then run
   from that exact point, drifting away from it — making `fit()` strictly *less* accurate than the
   closed form it started from.

## Decision

1. **Replace Nelder-Mead with Powell's conjugate-direction method** (`src/algorithms/powell.js`,
   exported as `powell`; `nelder-mead.js` deleted). Powell is derivative-free — so it keeps every
   robustness property that ruled out a gradient method — but converges faster and stagnates far
   less than the simplex. It is built from a `mnbrak` bracketer + Brent 1-D line search
   (Numerical Recipes §10.1–10.5). Three guards make it robust on the barrier objective:
   - **No-uphill `lineMin`**: a line search that finds nothing below the current point leaves the
     iterate unmoved (prevents drift when a whole line is infeasible/`Infinity`).
   - **Feasible-start repair** (`Distribution._feasibleStart`): when `_fitInit` lands in the
     infeasible region, probe for a finite-objective start by jittering all coordinates together
     (the diagonal moves a coordinate optimizer lacks), using a fixed PRNG seed so `fit()` stays
     deterministic.
   - **Non-finite-likelihood rejection** in the `fit()` objective: `±Infinity`/`NaN` log-likelihood
     → `Infinity` penalty. This keeps a strong optimizer out of unbounded-likelihood singularities
     (e.g. Beta-type density as a shape parameter → 0) that Nelder-Mead was simply too weak to find.

2. **Closed-form MLE fast path.** A distribution whose `_fitInit` returns the exact MLE declares an
   **own** `static get _fitInitIsExact () { return true }`. `fit()` checks for an *own* (not
   inherited) declaration via `Object.getOwnPropertyDescriptor` and, when present, returns
   `new this(..._fitInit(data))` directly — machine-precision, zero iterations, no drift. The
   own-property check is deliberate: a subclass with a different, approximate `_fitInit`
   (e.g. `Weibull extends Exponential`, `LogLaplace extends Laplace`) must not silently inherit the
   shortcut. The base-class default is `false`, so new distributions are safe by default.

3. **Twenty distributions are flagged exact**, each verified empirically (no parameter perturbation
   and no optimizer run improves the log-likelihood) and corroborated against the literature:
   Exponential, Normal, Poisson, Bernoulli, DiscreteUniform, Pareto, LogNormal, Rayleigh,
   MaxwellBoltzmann, HalfNormal, Geometric, Laplace, Reciprocal, Lindley, Uniform, InverseGaussian,
   LogitNormal (`μ̂,σ̂` = mean/std of `logit(x)`), PowerLaw (`â = −1/mean(log x)`), Borel
   (`μ̂ = 1 − 1/x̄`), BorelTanner (`n̂ = min`, `μ̂ = 1 − n̂/x̄`). Three had a closed-form MLE that
   `_fitInit` was *not* using and were rewritten to the exact estimator: Uniform (padded → `[min,max]`),
   InverseGaussian (moment estimate → `λ̂ = n/Σ(1/xᵢ − 1/x̄)`), PowerLaw (clamped → unclamped exact).
   A full empirical sweep over all 130+ `_fitInit` overrides confirmed no other distribution's seed is
   already at the MLE; apparent matches on integer-parameter families (Chi², F, IrwinHall, …) are
   rounding artifacts (the integer parameter cannot move under perturbation), not closed forms.

## Consequences

- **Easier/Better**: closed-form distributions return the exact MLE to machine precision; Powell
  finds tighter optima than Nelder-Mead on the hard cases (e.g. Hyperexponential, Bates, and
  bounded-support families recover planted parameters that previously sat at a stalled simplex).
- **Changed**: `fit()` may return slightly different — strictly more accurate — parameter estimates.
  This is a bug-fix-grade change (more accurate output), documented in the changelog, not a breaking
  API change: the signature and return type are unchanged.
- **Changed**: `src/algorithms/index.js` exports `powell` instead of `nelderMead`.
- **Harder**: adding a distribution with a genuinely unbounded likelihood still requires care — the
  non-finite-likelihood guard avoids returning a degenerate singularity, but a constrained or
  penalised optimizer (out of scope here) would be needed to fit such models rigorously.
