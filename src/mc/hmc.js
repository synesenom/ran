import MCMC from './_mcmc'
import { Normal } from '../dist'
import {
  createMetricState, updateAccumulator, refreshMetric, sampleMomentum, applyInverseMetric,
  kineticEnergy, snapshotMetric, snapshotAccumulator, validateMetric, validateDenseMetricDim,
  validateResumedMetric, validateResumedMetricAccumulator, DENSE_METRIC_REFRESH_INTERVAL
} from './_metric'

// Nesterov dual-averaging step-size adaptation (Hoffman & Gelman 2014, JMLR 15:1593-1623, S3.2):
// gamma is the adaptation learning rate, t0 stabilizes the first few iterations against a large
// initial |H_t|, kappa is the decay exponent for the running-average weight t^-kappa. These are
// the paper's own recommended defaults, not tuned for this codebase specifically.
const GAMMA = 0.05
const T0 = 10
const KAPPA = 0.75
// Target acceptance probability for plain HMC (Hoffman & Gelman 2014 S3.2); NUTS later uses 0.8.
const DELTA = 0.65
// Multiplicative step-size jitter bounds: drawing epsilon ~ Uniform(0.9*eps, 1.1*eps) per
// iteration avoids resonance artifacts a perfectly fixed step size can produce on periodic
// trajectories (Neal 2011; standard practice in Stan/PyMC). This jitters stepSize only --
// pathLength stays fixed, so a fixed trajectory length (pathLength * stepSize) can still land
// near a half-period of the target's natural oscillation at certain correlations, producing
// genuine negative lag-1 autocorrelation that ess()'s Geyer truncation correctly reports (not a
// bug in the online accumulator -- see #974). #1005's empirical sweep confirmed the resonance
// band can be as narrow as 2-3 integer pathLength steps, i.e. narrower than a +-10% jitter on
// pathLength would reliably escape -- see the class JSDoc below for the resulting user-facing
// guidance (try a different pathLength, or use NUTS) rather than a pathLength jitter here. See
// solutions/algorithm/2026-07-18-1657-hmc-pathlength-jitter-band-width-check.md
const JITTER_LO = 0.9
const JITTER_RANGE = 0.2

/**
 * Class implementing the [Hamiltonian Monte Carlo]{@link https://en.wikipedia.org/wiki/Hamiltonian_Monte_Carlo}
 * (HMC) sampler. Uses gradient information and a leapfrog integrator to simulate Hamiltonian
 * dynamics, proposing distant moves along the resulting trajectory and accepting/rejecting via
 * the Metropolis criterion on the augmented (position, momentum) system. Momenta are resampled
 * from a standard multivariate Normal at the start of every iteration. During warm-up, the step
 * size is adapted via Robbins-Monro dual averaging (Hoffman & Gelman 2014, S3.2) toward a target
 * acceptance probability, and jittered multiplicatively each iteration to avoid periodicity
 * artifacts.
 *
 * **Known limitation**: only `stepSize` is jittered — `pathLength` (the number of leapfrog
 * steps) stays fixed for the sampler's entire lifetime. A fixed trajectory length
 * (`pathLength * stepSize`) can still land near a half-period of the target's natural
 * oscillation at certain target correlations, producing genuine negative low-lag autocorrelation
 * that [ess()]{@link ran.mc.MCMC#ess} and [ac()]{@link ran.mc.MCMC#ac} faithfully report — this
 * is a legitimate property of the chain, not a bug in those estimators. If you observe this
 * (e.g. `ac()` reporting negative autocorrelation at low lags, or `ess()` reporting an effective
 * sample size well above or below the raw sample count), try a different `pathLength`, or switch
 * to [NUTS]{@link ran.mc.NUTS}, which adapts trajectory length automatically each iteration
 * (Hoffman & Gelman 2014) and removes the need to hand-tune `pathLength`.
 *
 * @class HMC
 * @memberof ran.mc
 * @param {Object} options Sampler options, as a single object.
 * @param {Function} options.logDensity The logarithm of the (unnormalized) target density.
 * @param {Function} options.gradLogDensity The gradient of logDensity: maps a state (number[]) to
 * its gradient (number[]) of the same dimension. The array passed in may be reused and mutated
 * across subsequent leapfrog steps; read it synchronously and do not retain the reference.
 * @param {Object=} options.config HMC configuration (see MCMC base class for shared options), plus
 * `stepSize` (ε, the leapfrog step size, default 0.1), `pathLength` (L, the number of leapfrog
 * steps per iteration, default 10 — fixed for the sampler's lifetime and not jittered like
 * `stepSize`; see the class JSDoc's "Known limitation" note for the resonance risk this can
 * produce), and `metric` (the mass matrix structure adapted during warm-up: `'diag'` (default)
 * estimates a per-dimension variance; `'dense'` estimates the full covariance matrix, refactored
 * through Matrix's LDL decomposition).
 * @param {Object=} options.initialState Initial state of the sampler (see MCMC base class).
 * @constructor
 * @throws {Error} If options is not a plain object, or gradLogDensity is not a function, or a
 * resumed initialState.internal.stepSize) is provided but is not a positive finite number, or a
 * pathLength (config.pathLength or a resumed initialState.internal.pathLength) is provided but
 * is not a positive integer or exceeds `HMC._MAX_PATH_LENGTH` (1024), or metric is provided but
 * is not `'diag'`/`'dense'`, or `'dense'` is
 * requested with a dimension exceeding the dense-metric cap, or a resumed
 * initialState.internal.metric does not match the resolved metric type/shape.
 */
// decisions/0020-mcmc-design.md — gradLogDensity is an HMC-specific constructor argument, not
// threaded through the shared MCMC base constructor
// decisions/0025-hmc-iter-alpha-field.md — _iter returns an additional alpha field so _adjust can
// drive dual averaging from the continuous Metropolis acceptance probability
// decisions/0029-hmc-euclidean-metric-adaptation.md — mass-matrix adaptation design: own
// accumulator, EPS*I regularization, diagonal default, dense opt-in via hand-rolled LDL
// forward/back substitution, batched dense refresh, dual averaging left uncoupled from metric
// changes
// decisions/0036-shared-metric-module.md — the accumulator/refresh/momentum/validator machinery now
// lives in the shared ./_metric module (extraction of HMC's and NUTS's former duplicates, #1041)
// decisions/0031-gradient-sampler-options-object-constructor.md — options-object-only constructor
// for HMC's extra gradLogDensity argument
export default class HMC extends MCMC {
  // Missed by #944's manual sweep of RWM/AdaptiveMetropolis/Gibbs constructors; added here
  // for correct tsc-generated param types. See
  // solutions/correctness/2026-07-16-1602-hmc-jsdoc-sibling-sweep-gap.md
  /**
   * @param {Object} options Sampler options, as a single object.
   * @param {Function} options.logDensity The logarithm of the (unnormalized) target density.
   * @param {Function} options.gradLogDensity The gradient of logDensity: maps a state (number[])
   * to its gradient (number[]) of the same dimension. The array passed in may be reused and
   * mutated across subsequent leapfrog steps; read it synchronously and do not retain the reference.
   * @param {Object=} options.config HMC configuration (see MCMC base class for shared options),
   * plus `stepSize` (ε, the leapfrog step size, default 0.1) and `pathLength` (L, the number of
   * leapfrog steps per iteration, default 10 — fixed for the sampler's lifetime; see the class
   * JSDoc's "Known limitation" note for the resonance risk this can produce).
   * @param {Object=} options.initialState Initial state of the sampler (see MCMC base class).
   * @throws {Error} If options is not a plain object.
   */
  constructor (options) {
    HMC._validateOptions(options)
    const { logDensity, gradLogDensity, config = {}, initialState = {} } = options
    super(logDensity, config, initialState)

    HMC._validateGradLogDensity(gradLogDensity)
    HMC._validateStepSize(config.stepSize)
    HMC._validatePathLength(config.pathLength)
    // A resumed sampler's initialState.internal is caller-supplied the same way config is (e.g.
    // round-tripped through state()) — validating only config would let a corrupted/adversarial
    // internal.pathLength (e.g. Infinity) reach _leapfrog's loop bound unchecked and hang.
    // See solutions/correctness/2026-07-15-1230-hmc-resumed-internal-state-validation-gap.md
    HMC._validateStepSize(this.internal.stepSize)
    HMC._validatePathLength(this.internal.pathLength)
    validateMetric('HMC', config.metric)
    this._metricType = config.metric === 'dense' ? 'dense' : 'diag'
    validateDenseMetricDim('HMC', this._metricType, this.dim)
    validateResumedMetric('HMC', this.internal.metric, this._metricType, this.dim)
    validateResumedMetricAccumulator('HMC', this.internal.metAccumulator, this._metricType, this.dim)

    this._gradLnp = gradLogDensity
    this._stepSize = this.internal.stepSize || config.stepSize || 0.1
    this._pathLength = this.internal.pathLength || config.pathLength || 10
    // Momentum component sampler, one Normal(0,1) draw per dimension per iteration.
    this._q = new Normal(0, 1)
    // decisions/0035-mcmc-exact-stream-reproducible-resume.md — restoring _q's own PRNG stream
    // is what makes resumed momentum draws bit-for-bit identical, not just statistically equivalent.
    MCMC._restoreQPrng(this._q, this.internal.prngQ, 'HMC')
    this.lastLnp = this.lnp(this.x)

    this._restoreDualAveraging()
    // decisions/0036-shared-metric-module.md — shared metric machinery on plain-object state.
    this._met = createMetricState({
      type: this._metricType,
      dim: this.dim,
      resumedMetric: this.internal.metric,
      resumedAccumulator: this.internal.metAccumulator
    })
  }

  /**
   * Sets the seed for the sampler's pseudo random number generator, including the internal
   * momentum distribution's generator.
   *
   * @method seed
   * @memberof ran.mc.HMC
   * @param {number|string} value The value of the seed, either a number or a string (for the ease of tracking seeds).
   * @returns {this} Reference to the current sampler.
   * @ignore
   */
  seed (value) {
    super.seed(value)
    this._reseedCachedLogDensity(value)
    return this
  }

  // ─── PROTECTED INSTANCE ───

  _iter (x, warmUp) {
    // One-time freeze on the first post-warm-up iteration: switch from the actively-adapting
    // exploration step size to the dual-averaging-smoothed value, and reset the shrinkage target
    // so a later warmUp() call (after sample()) adapts from the tuned step size rather than
    // pulling back toward the original construction-time epsilon.
    if (!warmUp && this._daT > 0) {
      this._stepSize = Math.exp(this._daLogEpsBar)
      this._daMu = Math.log(10 * this._stepSize)
      this._daT = 0
    }

    const eps = this._stepSize * (JITTER_LO + JITTER_RANGE * this.r.next())
    const r0 = sampleMomentum(this._met, this._q)
    const { x: xProp, r: rProp } = this._leapfrog(x, r0, eps)

    const logPProp = this.lnp(xProp)
    const kineticCur = kineticEnergy(this._met, r0)
    const kineticProp = kineticEnergy(this._met, rProp)
    const alpha = Math.min(1, Math.exp((logPProp - kineticProp) - (this.lastLnp - kineticCur)))
    const accepted = this.r.next() < alpha
    if (accepted) {
      this.lastLnp = logPProp
    }
    return { x: accepted ? xProp : x, accepted, alpha }
  }

  _adjust (i) {
    updateAccumulator(this._met, i.x)
    if (this._metricType === 'dense') {
      if (this._met.metN >= 2 * this.dim && this._met.metN % DENSE_METRIC_REFRESH_INTERVAL === 0) {
        refreshMetric(this._met)
      }
    } else if (this._met.metN >= 2 * this.dim) {
      // Statistical-quality gate, not a numerical-safety one (mirrors AdaptiveMetropolis's
      // identical 2*dim gate): EPS alone already keeps the variance away from exactly zero.
      // Refreshed every iteration since this path is O(dim), unlike the dense LDL refresh below.
      refreshMetric(this._met)
    }

    // Dual averaging is deliberately NOT reset when the metric changes above, even though the
    // literature (Hoffman & Gelman 2014; Betancourt 2017; Stan's adapt_diag_e_nuts.hpp) treats
    // stale step-size statistics under a changed metric as invalid, since the optimal step size
    // depends on the metric's local curvature. Doing this correctly needs the three-phase
    // windowed warm-up schedule decisions/0024-mcmc-warmup-convergence-strategy.md already rules
    // out replacing this flat batch loop with. See decisions/0029-hmc-euclidean-metric-adaptation.md.
    this._daT++
    // A NaN acceptance probability (e.g. a hand-written gradient that returns NaN near a support
    // boundary instead of a rigorous -Infinity) would otherwise be sticky: it flows through the
    // Robbins-Monro recursion into _daHbar -> _daLogEpsBar -> stepSize and freezes the sampler
    // forever with no error. Treat a non-finite alpha as 0 (a fully-rejected/divergent step), which
    // drives the step size down and lets warm-up recover, matching Stan's divergent-proposal handling.
    const alpha = Number.isFinite(i.alpha) ? i.alpha : 0
    this._daHbar = (1 - 1 / (this._daT + T0)) * this._daHbar + (1 / (this._daT + T0)) * (DELTA - alpha)
    const logEps = this._daMu - (Math.sqrt(this._daT) / GAMMA) * this._daHbar
    const w = Math.pow(this._daT, -KAPPA)
    this._daLogEpsBar = w * logEps + (1 - w) * this._daLogEpsBar
    this._stepSize = Math.exp(logEps)
  }

  _internal () {
    return {
      stepSize: this._stepSize,
      pathLength: this._pathLength,
      metric: snapshotMetric(this._met),
      prngQ: this._q.r.save(),
      daMu: this._daMu,
      daHbar: this._daHbar,
      daLogEpsBar: this._daLogEpsBar,
      daT: this._daT,
      metAccumulator: snapshotAccumulator(this._met)
    }
  }

  // ─── PROTECTED STATIC ───

  // Kept out of the constructor to avoid a Complex Conditional / Complex Method smell there.
  // Destructuring options directly in the constructor's parameter list would throw a generic,
  // engine-dependent TypeError for null (default parameters only cover undefined) instead of this
  // clear, HMC-specific message.
  // See decisions/0032-mala-options-object-only-constructor.md and
  // solutions/correctness/2026-07-18-1147-mala-null-guard-destructured-parameter-gap.md
  static _validateOptions (options) {
    if (!HMC._isPlainObject(options)) {
      throw Error('HMC: constructor requires an options object: new HMC({ logDensity, gradLogDensity, config, initialState })')
    }
  }

  // Split from _validateOptions so the compound check is a single return expression rather than
  // a branch condition, which is what the Complex Conditional smell flags.
  static _isPlainObject (options) {
    return options !== undefined && options !== null && typeof options === 'object' && !Array.isArray(options)
  }

  // Kept out of the constructor to avoid a Complex Conditional / Complex Method smell there.
  static _validateGradLogDensity (gradLogDensity) {
    if (typeof gradLogDensity !== 'function') {
      throw Error('HMC: gradLogDensity must be a function')
    }
  }

  // Kept out of the constructor to avoid a Complex Conditional / Complex Method smell there.
  static _validateStepSize (stepSize) {
    if (stepSize === undefined) {
      return
    }
    if (!(Number.isFinite(stepSize) && stepSize > 0)) {
      throw Error('HMC: stepSize must be a positive number')
    }
  }

  // Kept out of the constructor to avoid a Complex Conditional / Complex Method smell there.
  static _validatePathLength (pathLength) {
    if (pathLength === undefined) {
      return
    }
    if (!HMC._isPositiveInteger(pathLength)) {
      throw Error('HMC: pathLength must be a positive integer')
    }
    // pathLength directly multiplies the gradient evaluations per _iter() call via the leapfrog
    // integrator; unbounded, it lets a caller-supplied config hang warmUp()/sample() indefinitely
    // with no error, the same class of risk _MAX_DIM/_MAX_LAG/_MAX_AR_WINDOW guard for allocation
    // footprint. See #947.
    if (pathLength > HMC._MAX_PATH_LENGTH) {
      throw Error(`HMC: pathLength must be at most ${HMC._MAX_PATH_LENGTH}`)
    }
  }

  static _isPositiveInteger (value) {
    return Number.isInteger(value) && value > 0
  }

  // pathLength bounds per-iteration leapfrog steps -- compute cost (calls to the caller-supplied,
  // arbitrary-cost gradLogDensity), not allocation footprint like _MAX_DIM/_MAX_LAG/_MAX_AR_WINDOW,
  // which bound predictable bytes-per-unit typed-array allocations. 1024 = 2^10 matches the
  // sibling NUTS sampler's own MAX_TREE_DEPTH ceiling (src/mc/nuts.js), itself the Stan/PyMC/NumPyro
  // default -- real trajectories U-turn well before this. HMC's per-step leapfrog cost matches NUTS's
  // (both apply the adapted mass-matrix metric via applyInverseMetric), so borrowing NUTS's ceiling is
  // conservative. Neal (2011) gives no canonical fixed-L value -- this is the closest literature
  // anchor available. See #989 and
  // solutions/correctness/2026-07-18-1526-hmc-max-path-length-sibling-bound-risk-class-mismatch.md
  static get _MAX_PATH_LENGTH () {
    return 1024
  }

  // ─── PRIVATE INSTANCE ───

  // Leapfrog integrator (Neal 2011, Algorithm 1): half-step momentum, full-step position,
  // half-step momentum, repeated for pathLength steps. Uses the simple unmerged form (two half
  // steps per leapfrog step) rather than the trailing/leading half-step merge optimization, for
  // a direct, easily-verified match to the textbook algorithm. Inline (not part of the shared
  // metric module) because it applies the adapted metric's M^-1 to the position update via
  // applyInverseMetric -- NUTS has its own inline metric-aware leapfrog for the same reason
  // (decisions/0034-nuts-euclidean-metric-adaptation.md).
  _leapfrog (x, r, eps) {
    const xCur = x.slice()
    const rCur = r.slice()
    const n = xCur.length
    for (let l = 0; l < this._pathLength; l++) {
      const grad0 = this._gradLnp(xCur)
      for (let i = 0; i < n; i++) {
        rCur[i] += 0.5 * eps * grad0[i]
      }
      const mInvR = applyInverseMetric(this._met, rCur)
      for (let i = 0; i < n; i++) {
        xCur[i] += eps * mInvR[i]
      }
      const grad1 = this._gradLnp(xCur)
      for (let i = 0; i < n; i++) {
        rCur[i] += 0.5 * eps * grad1[i]
      }
    }
    return { x: xCur, r: rCur }
  }
}
