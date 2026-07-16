import MCMC from './_mcmc'
import { Normal } from '../dist'
import Matrix from '../la/matrix'

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
// trajectories (Neal 2011; standard practice in Stan/PyMC).
const JITTER_LO = 0.9
const JITTER_RANGE = 0.2
// Regularization added to the estimated metric (variance or covariance) before it is used,
// matching AdaptiveMetropolis's EPS*I convention: keeps the diagonal variance away from exactly
// zero and keeps ldl() -- which has no pivoting or singularity guard -- from hitting a
// non-positive pivot while the dense covariance accumulator is still rank deficient.
const EPS = 1e-6

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
 * @class HMC
 * @memberof ran.mc
 * @param {Function} logDensity The logarithm of the (unnormalized) target density.
 * @param {Function} gradLogDensity The gradient of logDensity: maps a state (number[]) to its
 * gradient (number[]) of the same dimension.
 * @param {Object=} config HMC configuration (see MCMC base class for shared options), plus
 * `stepSize` (ε, the leapfrog step size, default 0.1), `pathLength` (L, the number of leapfrog
 * steps per iteration, default 10), and `metric` (the mass matrix structure adapted during
 * warm-up: `'diag'` (default) estimates a per-dimension variance; `'dense'` estimates the full
 * covariance matrix, refactored through Matrix's LDL decomposition).
 * @param {Object=} initialState Initial state of the sampler (see MCMC base class).
 * @constructor
 * @throws {Error} If gradLogDensity is not a function, or a stepSize (config.stepSize or a
 * resumed initialState.internal.stepSize) is provided but is not a positive finite number, or a
 * pathLength (config.pathLength or a resumed initialState.internal.pathLength) is provided but
 * is not a positive integer, or metric is provided but is not `'diag'`/`'dense'`, or `'dense'` is
 * requested with a dimension exceeding the dense-metric cap, or a resumed
 * initialState.internal.metric does not match the resolved metric type/shape.
 */
// decisions/0020-mcmc-design.md — gradLogDensity is an HMC-specific constructor argument, not
// threaded through the shared MCMC base constructor
// decisions/0025-hmc-iter-alpha-field.md — _iter returns an additional alpha field so _adjust can
// drive dual averaging from the continuous Metropolis acceptance probability
// decisions/0028-hmc-euclidean-metric-adaptation.md — mass-matrix adaptation design: own
// accumulator, EPS*I regularization, diagonal default, dense opt-in via hand-rolled LDL
// forward/back substitution, batched dense refresh, dual averaging left uncoupled from metric
// changes
export default class HMC extends MCMC {
  constructor (logDensity, gradLogDensity, config = {}, initialState = {}) {
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
    HMC._validateMetric(config.metric)
    this._metricType = config.metric === 'dense' ? 'dense' : 'diag'
    HMC._validateDenseMetricDim(this._metricType, this.dim)
    HMC._validateResumedMetric(this.internal.metric, this._metricType, this.dim)

    this._gradLnp = gradLogDensity
    this._stepSize = this.internal.stepSize || config.stepSize || 0.1
    this._pathLength = this.internal.pathLength || config.pathLength || 10
    // Momentum component sampler, one Normal(0,1) draw per dimension per iteration.
    this._q = new Normal(0, 1)
    this.lastLnp = this.lnp(this.x)

    // Dual-averaging state (Hoffman & Gelman 2014 S3.2): mu is the shrinkage target, Hbar the
    // running acceptance-probability-deviation statistic, logEpsBar the smoothed log step size,
    // t the iteration counter. Ephemeral — not part of _internal()'s serialized state, matching
    // RWM's precedent of serializing only the effective proposal scale, not its own Robbins-Monro
    // batch counters.
    this._daMu = Math.log(10 * this._stepSize)
    this._daHbar = 0
    this._daLogEpsBar = Math.log(this._stepSize)
    this._daT = 0

    this._initMetricState(this.internal.metric)
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
    const r0 = this._sampleMomentum()
    const { x: xProp, r: rProp } = this._leapfrog(x, r0, eps)

    const logPProp = this.lnp(xProp)
    const kineticCur = this._kineticEnergy(r0)
    const kineticProp = this._kineticEnergy(rProp)
    const alpha = Math.min(1, Math.exp((logPProp - kineticProp) - (this.lastLnp - kineticCur)))
    const accepted = this.r.next() < alpha
    if (accepted) {
      this.lastLnp = logPProp
    }
    return { x: accepted ? xProp : x, accepted, alpha }
  }

  _adjust (i) {
    this._updateMetricAccumulator(i.x)
    if (this._metricType === 'dense') {
      if (this._metN >= 2 * this.dim && this._metN % HMC._DENSE_METRIC_REFRESH_INTERVAL === 0) {
        this._refreshMetric()
      }
    } else if (this._metN >= 2 * this.dim) {
      // Statistical-quality gate, not a numerical-safety one (mirrors AdaptiveMetropolis's
      // identical 2*dim gate): EPS alone already keeps the variance away from exactly zero.
      // Refreshed every iteration since this path is O(dim), unlike the dense LDL refresh below.
      this._refreshMetric()
    }

    // Dual averaging is deliberately NOT reset when the metric changes above, even though the
    // literature (Hoffman & Gelman 2014; Betancourt 2017; Stan's adapt_diag_e_nuts.hpp) treats
    // stale step-size statistics under a changed metric as invalid, since the optimal step size
    // depends on the metric's local curvature. Doing this correctly needs the three-phase
    // windowed warm-up schedule decisions/0024-mcmc-warmup-convergence-strategy.md already rules
    // out replacing this flat batch loop with. See decisions/0028-hmc-euclidean-metric-adaptation.md.
    this._daT++
    this._daHbar = (1 - 1 / (this._daT + T0)) * this._daHbar + (1 / (this._daT + T0)) * (DELTA - i.alpha)
    const logEps = this._daMu - (Math.sqrt(this._daT) / GAMMA) * this._daHbar
    const w = Math.pow(this._daT, -KAPPA)
    this._daLogEpsBar = w * logEps + (1 - w) * this._daLogEpsBar
    this._stepSize = Math.exp(logEps)
  }

  _internal () {
    return {
      stepSize: this._stepSize,
      pathLength: this._pathLength,
      // Serializes only the effective, ready-to-use metric (mirrors AdaptiveMetropolis's
      // _internal(): "serialize the effective proposal, not raw adaptation counters").
      metric: this._metricType === 'dense'
        ? { type: 'dense', L: this._metL.map(row => row.slice()), D: this._metD.slice() }
        : { type: 'diag', variance: this._metVar.slice() }
    }
  }

  // ─── PROTECTED STATIC ───

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
  }

  static _isPositiveInteger (value) {
    return Number.isInteger(value) && value > 0
  }

  // Kept out of the constructor to avoid a Complex Conditional / Complex Method smell there.
  static _validateMetric (metric) {
    if (metric === undefined) {
      return
    }
    if (metric !== 'diag' && metric !== 'dense') {
      throw Error("HMC: metric must be 'diag' or 'dense'")
    }
  }

  // A dense metric's covariance accumulator and LDL factor are both dim*dim -- MCMC's own
  // _validateCombinedFootprint only bounds dim*maxLag (the autocorrelation buffers), so it does
  // not itself catch a dense-metric blowup at MCMC._MAX_DIM = 10000 (~800MB). See
  // decisions/0028-hmc-euclidean-metric-adaptation.md.
  static _validateDenseMetricDim (metricType, dim) {
    if (metricType === 'dense' && dim > HMC._MAX_DENSE_METRIC_DIM) {
      throw Error(`HMC: metric: 'dense' requires dim to be at most ${HMC._MAX_DENSE_METRIC_DIM}`)
    }
  }

  // A resumed initialState.internal.metric is caller-supplied the same way config is -- see the
  // stepSize/pathLength validation above and
  // solutions/correctness/2026-07-15-1230-hmc-resumed-internal-state-validation-gap.md. Kept out
  // of the constructor to avoid a Complex Conditional / Complex Method smell there.
  static _validateResumedMetric (metric, metricType, dim) {
    if (metric === undefined) {
      return
    }
    if (metric.type !== metricType) {
      throw Error('HMC: resumed metric type does not match the resolved metric')
    }
    if (metricType === 'dense') {
      HMC._validateResumedDenseMetric(metric, dim)
    } else {
      HMC._validateResumedDiagMetric(metric, dim)
    }
  }

  static _validateResumedDiagMetric (metric, dim) {
    if (!HMC._isPositiveFiniteVector(metric.variance, dim)) {
      throw Error('HMC: resumed metric.variance must be an array of dim positive finite numbers')
    }
  }

  static _validateResumedDenseMetric (metric, dim) {
    if (!HMC._isPositiveFiniteVector(metric.D, dim)) {
      throw Error('HMC: resumed metric.D must be an array of dim positive finite numbers')
    }
    if (!HMC._isFiniteMatrix(metric.L, dim)) {
      throw Error('HMC: resumed metric.L must be a dim x dim array of finite numbers')
    }
  }

  static _isFiniteVector (arr, length) {
    return Array.isArray(arr) && arr.length === length && arr.every(Number.isFinite)
  }

  static _isPositiveFiniteVector (arr, length) {
    return HMC._isFiniteVector(arr, length) && arr.every(v => v > 0)
  }

  static _isFiniteMatrix (rows, dim) {
    return Array.isArray(rows) && rows.length === dim && rows.every(row => HMC._isFiniteVector(row, dim))
  }

  static get _MAX_DENSE_METRIC_DIM () {
    return 1000
  }

  // Matrix.ldl() is O(dim^3); refreshing the dense metric every iteration (as the diagonal case
  // and AdaptiveMetropolis both do cheaply) would make dense warm-up cost scale with
  // O(dim^3) * iterations. This interval is a fixed, non-configurable HMC constant, deliberately
  // decoupled from MCMC.warmUp()'s own internal batch size so a future change to one cannot
  // silently change the other's behavior. See decisions/0028-hmc-euclidean-metric-adaptation.md.
  static get _DENSE_METRIC_REFRESH_INTERVAL () {
    return 1000
  }

  // ─── PRIVATE INSTANCE ───

  // Sets up the mass-matrix (metric) online accumulator and the effective (ready-to-use) metric
  // consulted by _sampleMomentum/_applyInverseMetric. Extracted out of the constructor to avoid
  // a Complex Method smell there. See decisions/0028-hmc-euclidean-metric-adaptation.md.
  _initMetricState (resumedMetric) {
    this._initMetricAccumulator()
    this._initEffectiveMetric(resumedMetric)
  }

  // Entirely private to HMC -- deliberately not reusing MCMC's own _welford accumulator (which
  // is contractual per decisions/0023-mcmc-accumulator-mechanics.md and tracks a different
  // lifecycle), mirroring AdaptiveMetropolis building its own _covMean/_covS instead of reaching
  // into the base class.
  _initMetricAccumulator () {
    this._metN = 0
    this._metMean = new Array(this.dim).fill(0)
    if (this._metricType === 'dense') {
      this._metCovS = Array.from({ length: this.dim }, () => new Array(this.dim).fill(0))
      this._metDelta = new Array(this.dim).fill(0)
      this._metDelta2 = new Array(this.dim).fill(0)
      this._zBuffer = new Array(this.dim).fill(0)
    } else {
      this._metM2 = new Array(this.dim).fill(0)
    }
  }

  // Seeded from a resumed state or the identity default -- kept separate from the accumulator so
  // a resumed sampler uses its adapted metric immediately without waiting for _metN to re-cross
  // the refresh gate.
  _initEffectiveMetric (resumedMetric) {
    if (this._metricType === 'dense') {
      this._metL = resumedMetric ? resumedMetric.L.map(row => row.slice()) : HMC._identityRows(this.dim)
      this._metD = resumedMetric ? resumedMetric.D.slice() : new Array(this.dim).fill(1)
    } else {
      this._metVar = resumedMetric ? resumedMetric.variance.slice() : new Array(this.dim).fill(1)
    }
  }

  // Online (Welford-style) update of the metric accumulator -- the same recurrence as
  // AdaptiveMetropolis._updateCovariance (dense) and the base class's own per-dimension Welford
  // update (diagonal), fed the post-accept/reject state per _adjust's contract.
  _updateMetricAccumulator (x) {
    this._metN++
    if (this._metricType === 'dense') {
      this._updateDenseMetricAccumulator(x)
    } else {
      this._updateDiagMetricAccumulator(x)
    }
  }

  _updateDiagMetricAccumulator (x) {
    const n = this._metN
    for (let i = 0; i < this.dim; i++) {
      const delta = x[i] - this._metMean[i]
      this._metMean[i] += delta / n
      this._metM2[i] += delta * (x[i] - this._metMean[i])
    }
  }

  _updateDenseMetricAccumulator (x) {
    const n = this._metN
    const delta = this._metDelta
    const delta2 = this._metDelta2
    for (let i = 0; i < this.dim; i++) {
      delta[i] = x[i] - this._metMean[i]
    }
    for (let i = 0; i < this.dim; i++) {
      this._metMean[i] += delta[i] / n
    }
    for (let i = 0; i < this.dim; i++) {
      delta2[i] = x[i] - this._metMean[i]
    }
    for (let i = 0; i < this.dim; i++) {
      for (let j = 0; j < this.dim; j++) {
        this._metCovS[i][j] += delta[i] * delta2[j]
      }
    }
  }

  // Refactorizes the effective metric from the accumulator. Diagonal: elementwise sample
  // variance + EPS, no factorization needed. Dense: Cov(x) + EPS*I via a transient Matrix,
  // decomposed via ldl() and extracted to plain arrays -- the Matrix instances never leave this
  // method as fields (see solutions/tooling/2026-07-15-1330-adaptive-metropolis-ran-la-matrix-dts-leak.md).
  _refreshMetric () {
    if (this._metricType === 'dense') {
      const cov = new Matrix(this._metCovS).scale(1 / (this._metN - 1)).add(new Matrix(this.dim).scale(EPS))
      const { D, L } = cov.ldl()
      this._metL = L.m()
      this._metD = Array.from({ length: this.dim }, (_, i) => D.ij(i, i))
    } else {
      this._metVar = this._metM2.map(m2 => m2 / (this._metN - 1) + EPS)
    }
  }

  // Leapfrog integrator (Neal 2011, Algorithm 1): half-step momentum, full-step position,
  // half-step momentum, repeated for pathLength steps. Uses the simple unmerged form (two half
  // steps per leapfrog step) rather than the trailing/leading half-step merge optimization, for
  // a direct, easily-verified match to the textbook algorithm.
  _leapfrog (x, r, eps) {
    let xCur = x.slice()
    let rCur = r.slice()
    for (let l = 0; l < this._pathLength; l++) {
      const grad0 = this._gradLnp(xCur)
      rCur = rCur.map((ri, i) => ri + 0.5 * eps * grad0[i])
      const mInvR = this._applyInverseMetric(rCur)
      xCur = xCur.map((xi, i) => xi + eps * mInvR[i])
      const grad1 = this._gradLnp(xCur)
      rCur = rCur.map((ri, i) => ri + 0.5 * eps * grad1[i])
    }
    return { x: xCur, r: rCur }
  }

  // Draws momentum p ~ N(0, M). The mass matrix is the *precision*, M = Sigma^-1, where Sigma is
  // the estimated covariance/variance (decisions/0028-hmc-euclidean-metric-adaptation.md, per the
  // issue's M = Cov(theta)^-1): a LARGER estimated variance means a MORE CONCENTRATED momentum
  // distribution, so the metric can compensate for wide target directions. Diagonal: elementwise,
  // no factorization needed. Dense: Sigma = L*D*L^T (from ldl()), and p ~ N(0, Sigma^-1) is drawn
  // as p solving L^T*p = z/sqrt(D) via back substitution -- see the momentum-sampling derivation
  // backing decisions/0028-hmc-euclidean-metric-adaptation.md.
  // M and M^-1 are easy to swap here -- see solutions/correctness/2026-07-16-1422-hmc-mass-matrix-precision-inversion.md
  _sampleMomentum () {
    if (this._metricType === 'dense') {
      for (let i = 0; i < this.dim; i++) {
        this._zBuffer[i] = this._q.sample()
      }
      const u = this._zBuffer.map((z, i) => z / Math.sqrt(this._metD[i]))
      return HMC._backSubstituteTranspose(this._metL, u)
    }
    return Array.from({ length: this.dim }, (_, i) => this._q.sample() / Math.sqrt(this._metVar[i]))
  }

  // Computes M^-1 * p, needed both for the leapfrog position update and the kinetic energy. Since
  // M = Sigma^-1 (the precision), M^-1 * p = Sigma * p directly -- the estimated covariance
  // applied to p, not its inverse. Diagonal: elementwise multiplication. Dense: Sigma * p = L*D*L^T*p,
  // computed as three plain matrix-vector products (no solve needed here -- only momentum sampling
  // above needs a substitution, since it draws from the *precision*, not the covariance).
  _applyInverseMetric (p) {
    if (this._metricType === 'dense') {
      const L = this._metL
      const n = this.dim
      // v = L^T * p
      const v = new Array(n).fill(0)
      for (let i = 0; i < n; i++) {
        for (let j = 0; j <= i; j++) {
          v[j] += L[i][j] * p[i]
        }
      }
      // w = D * v
      const w = v.map((vi, i) => vi * this._metD[i])
      // result = L * w
      return L.map(row => row.reduce((s, lij, j) => s + lij * w[j], 0))
    }
    return p.map((pi, i) => pi * this._metVar[i])
  }

  // Kinetic energy K(p) = 1/2 * p^T * M^-1 * p.
  _kineticEnergy (p) {
    const mInvP = this._applyInverseMetric(p)
    return 0.5 * p.reduce((s, pi, i) => s + pi * mInvP[i], 0)
  }

  // ─── PRIVATE STATIC ───

  // Dense metric's identity default (no observations yet to base a covariance estimate on) --
  // isolated here rather than an inline nested-loop literal in the constructor.
  static _identityRows (dim) {
    return Array.from({ length: dim }, (_, i) => Array.from({ length: dim }, (_, j) => (i === j ? 1 : 0)))
  }

  // Solves L^T*y = v for y, where L is unit lower triangular so L^T is unit upper triangular
  // (L^T[i][j] = L[j][i]).
  static _backSubstituteTranspose (L, v) {
    const n = v.length
    const y = new Array(n)
    for (let i = n - 1; i >= 0; i--) {
      let s = v[i]
      for (let j = i + 1; j < n; j++) {
        s -= L[j][i] * y[j]
      }
      y[i] = s
    }
    return y
  }
}
