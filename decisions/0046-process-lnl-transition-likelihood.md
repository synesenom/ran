# ADR-0046: Process.lnL(path) Computes Transition, Not Marginal, Log-Likelihood

**Date**: 2026-08-01
**Status**: Accepted

## Context

`ran.process.Process` has no counterpart to `ran.dist.Distribution.lnL(data)` (the log-likelihood
of a data sample under a fitted distribution). Issue #1153 asked for one, scoring how well a
parameterized process explains an *observed discrete-time path* — the primitive downstream MLE
calibration of SDEs needs (`Process.static fit(path, dt)`, ADR-0044, already exists as the inverse
operation: estimate parameters from a path; this ADR adds the forward operation: score a path
given parameters).

Two candidate semantics existed, and the issue explicitly required resolving between them before
implementation:

- **Marginal**: sum of `log(pdf(x_i, t_i))`, treating each path point as an independent draw from
  the process's marginal law from the fixed initial state `x0`. This is statistically wrong for a
  single realized path — the points of one trajectory are not independent draws from the marginal;
  they are a *dependent, Markov-correlated* sequence. It is only meaningful if there is exactly one
  observation per process instance, which is not what "path" means anywhere else in this codebase
  (`path(n)` returns `n+1` sequential states of *one* realization, per `_process.js:143-153`).
- **Transition**: sum of `log(transition density from x_i to x_{i+1} over dt)`. This is the
  statistically correct likelihood of a discrete-time Markov path and is exactly what MLE
  calibration of SDEs requires (it is the objective a Metropolis-Hastings or gradient-based
  calibrator would need to evaluate).

A directly analogous bug already surfaced this exact distinction: issue #1133 found that
`CoxIngersollRoss`'s Gamma marginal (used by `pdf(x,t)`/`marginal(t)`) is *not* the conditional
transition density for a path step — they coincide only because `CoxIngersollRoss` hardcodes
`x0 = 0`, which degenerates the true noncentral-chi-squared transition's noncentrality term to
zero (see `solutions/correctness/2026-07-28-1600-cir-conditional-vs-marginal-gamma-mismatch.md`).
That incident is direct evidence that conflating marginal and transition densities produces
plausible-looking but statistically wrong numbers in this exact codebase, not just a hypothetical
concern.

Separately, every one of the three in-scope processes — `BrownianMotion`, `OrnsteinUhlenbeck`,
`GeometricBrownianMotion` — already has its *exact* one-step transition law encoded in `_next()`
(Euler–Maruyama coincides with the true transition for all three, per each file's own top-of-file
derivation), and `fit()` (ADR-0044) already computes each transition's sufficient statistics
(increments, OLS residuals, log-returns) to perform MLE. The transition-likelihood math is
therefore already implicit in the existing code; only marginal likelihood would require *new*
reasoning about an object (independent marginal draws) this codebase's `path()` semantics don't
actually produce.

Two secondary questions followed once transition semantics was settled:

1. **Naming.** The issue title says `likelihood(path)`; `CLAUDE.md` also describes `Distribution`'s
   derived API informally as `likelihood()`. But `Distribution`'s actual public method is named
   `lnL(data)` (`src/dist/_distribution.js:411`), not `likelihood`. Consistency with the real,
   existing API surface takes precedence over the issue title's informal phrasing.
2. **Shape.** Whether `Process` should gain a base-class method that loops over path pairs and
   delegates to a new protected per-subclass hook (mirroring `Distribution.lnPdf`/`lnL`'s split),
   or whether each subclass should override the full method and duplicate the loop/summation logic.
   `Process` already has this exact shape once: `path(n)` (base-class loop) delegates to `_next()`
   (per-subclass hook) — the factored shape has direct precedent within `Process` itself, not just
   by analogy to `Distribution`.

## Decision

`Process` gains a new **public instance** method, `lnL(path)`, added to the abstract base class as
a throw-by-default hook (matching the existing `covariogram`/`mean`/`variance`/`pdf`/`marginal`
pattern): it validates `path` has at least 2 states, then computes
`neumaier(pairs.map(([xPrev, xNext]) => this._transitionLnPdf(xPrev, xNext)))` over every
consecutive pair — using `neumaier()` for compensated summation, exactly mirroring
`Distribution.lnL(data) = neumaier(data.map(d => this.lnPdf(d)))`.

`Process` also gains a new **protected** hook, `_transitionLnPdf(xPrev, xNext)`, throwing
`Error('Process._transitionLnPdf() is not implemented')` by default. `lnL(path)` itself is **not**
overridden per subclass — only `_transitionLnPdf` is — so the loop/validation/summation logic
lives in exactly one place.

`lnL(path)` takes **no `dt` argument**. Unlike `static fit(path, dt)` (a factory with no existing
instance to query, so `dt` must be supplied), `lnL` is an instance method on an already-parameterized
process; `dt` is already `this.p.dt`, and every subclass's `_transitionLnPdf` reads the precomputed
transition constants already sitting in `this.c` (`sqrtDt` for `BrownianMotion`; `decay`/`noise` for
`OrnsteinUhlenbeck`; `drift`/`noise` for `GeometricBrownianMotion`) rather than recomputing them
from raw parameters. Scoring a path sampled at a different `dt` is served by constructing a new
instance with that `dt`, not by a parameter on `lnL`.

`BrownianMotion`, `OrnsteinUhlenbeck`, and `GeometricBrownianMotion` override `_transitionLnPdf` with
their closed-form Gaussian (BM, OU) or log-Gaussian-with-Jacobian (GBM) transition log-density.
`GeometricBrownianMotion._transitionLnPdf` returns `-Infinity` for `xNext <= 0` (mirroring
`pdf(x,t)`'s existing `return 0` for `x <= 0` at `geometric-brownian-motion.js:62` — the
mathematically correct log-density of an impossible state is `-Infinity`, not a thrown error, per
`decisions/0015-return-value-and-error-conventions.md`). `neumaier()` already skips its
compensation term when a running or partial sum is non-finite (`src/algorithms/neumaier.js:24`), so
a `-Infinity` transition term propagates correctly to a `-Infinity` total rather than collapsing to
`NaN`.

Other `Process` subclasses without a closed-form transition density (`RandomWalk`,
`PoissonProcess`, `CompoundPoissonProcess`, `AR1`, `CoxIngersollRoss`, `BrownianBridge`) are left on
the base class's throwing default — this ADR does not require every process to implement `lnL`,
only that those with a tractable closed form do, mirroring ADR-0040's and ADR-0044's partial
rollouts. `CoxIngersollRoss` in particular is deliberately excluded: its true conditional transition
is noncentral chi-squared, the exact trap this ADR's Context section already documents as a past
bug (#1133) — implementing it correctly is out of scope here and belongs in a dedicated follow-up.

## Consequences

**Easier:**
- Callers with an observed path and a parameterized `BrownianMotion`/`OrnsteinUhlenbeck`/
  `GeometricBrownianMotion` instance can now score `process.lnL(path)` directly, the primitive
  needed for MLE calibration, model comparison (via a future `Process.aic()`/`bic()`, out of scope
  here), or manual likelihood-ratio tests — with zero new numerical machinery, reusing the same
  `this.c` constants `_next()` already relies on.
- The factored `lnL`/`_transitionLnPdf` split keeps the loop/validation/neumaier-summation logic in
  one place, so future processes with a closed-form transition (e.g. `BrownianBridge`, whose
  transition is also Gaussian) need only add a `_transitionLnPdf` override, not reimplement the loop.
- The marginal-vs-transition question is now documented once, for this codebase, at the API level —
  future contributors adding `lnL` to another process do not need to re-litigate it; they can point
  here.

**Harder:**
- `Process.lnL()`'s name does not match the issue title's `likelihood()`; anyone searching the issue
  text for the method name by string match will not find it. This is a deliberate, documented
  trade-off in favor of internal consistency with `Distribution.lnL`.
- If `CoxIngersollRoss` (or any future process) ever gains a true closed-form conditional transition
  density (noncentral chi-squared), extending `lnL` to it requires new special-function machinery
  this ADR does not introduce — a separate, larger follow-up issue, not a small addition to this one.
- Because `_transitionLnPdf` reads `this.c`/`this.p` for the instance's own `dt`, there is no way to
  evaluate the likelihood of a path sampled at a *different* time step without constructing a second
  instance; this is intentional (see Decision) but means `lnL` cannot itself be reused as a
  general-purpose "evaluate at arbitrary dt" utility.
