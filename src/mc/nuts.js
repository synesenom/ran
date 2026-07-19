import MCMC from './_mcmc'
import { Normal } from '../dist'
import Matrix from '../la/matrix'

// Nesterov dual-averaging step-size adaptation (Hoffman & Gelman 2014, JMLR 15:1593-1623, S3.2):
// gamma is the adaptation learning rate, t0 stabilizes the first few iterations against a large
// initial |H_t|, kappa is the decay exponent for the running-average weight t^-kappa. Same values
// as HMC (kept as separate local constants — HMC does not export these, and three duplicated
// numeric constants do not warrant a shared module).
const GAMMA = 0.05
const T0 = 10
const KAPPA = 0.75
// Target acceptance probability for NUTS (Hoffman & Gelman 2014 S3.2); higher than plain HMC's
// 0.65 because NUTS's own trajectory-length tuning benefits from a smaller step size.
const DELTA = 0.8
// Caps the doubling-tree recursion depth (Stan/PyMC/NumPyro default). 2^10 = 1024 leapfrog steps
// per outer iteration is a generous ceiling — real trajectories U-turn well before this. Hardcoded
// rather than configurable: the issue scopes only `stepSize` as tunable, and CLAUDE.md's
// no-speculative-abstractions rule argues against adding a knob nothing has asked for yet.
const MAX_TREE_DEPTH = 10
// Energy-divergence guard for BuildTree's base case (Hoffman & Gelman 2014, the paper's standard
// default): a leapfrog point whose Hamiltonian drifts more than this many nats from the trajectory's
// start is numerically diverging and is excluded from the slice, stopping that branch of the tree.
const DELTA_MAX = 1000
// Regularization added to the estimated metric (variance or covariance) before it is used, matching
// HMC's and AdaptiveMetropolis's EPS*I convention: keeps the diagonal variance away from exactly
// zero and keeps ldl() -- which has no pivoting or singularity guard -- from hitting a non-positive
// pivot while the dense covariance accumulator is still rank deficient.
const EPS = 1e-6

/**
 * Class implementing the [No-U-Turn Sampler]{@link https://jmlr.org/papers/v15/hoffman14a.html}
 * (NUTS). Extends Hamiltonian Monte Carlo by replacing a fixed-length leapfrog trajectory with a
 * recursive doubling-tree procedure that extends forward or backward in a randomly chosen
 * direction until the trajectory's outer endpoints start turning back toward each other (the
 * "U-turn" stopping criterion) or a maximum tree depth is reached. The transition is selected via
 * slice sampling over the tree's valid states, eliminating the need to hand-tune a trajectory
 * length. Momenta are resampled from `N(0, M)` at the start of every iteration, where `M` is the
 * Euclidean mass matrix adapted during warm-up (`config.metric`); the no-U-turn criterion is
 * evaluated on the velocity `M⁻¹r`. During warm-up, the step size is adapted via Robbins-Monro
 * dual averaging (Hoffman & Gelman 2014, S3.2) toward a target acceptance probability, driven by
 * the tree-averaged acceptance statistic accumulated across every leapfrog evaluation in that
 * iteration's tree.
 *
 * @class NUTS
 * @memberof ran.mc
 * @param {Object} options Sampler options, as a single object.
 * @param {Function} options.logDensity The logarithm of the (unnormalized) target density.
 * @param {Function} options.gradLogDensity The gradient of logDensity: maps a state (number[]) to
 * its gradient (number[]) of the same dimension.
 * @param {Object=} options.config NUTS configuration (see MCMC base class for shared options),
 * plus `stepSize` (ε, the leapfrog step size, default 0.1) and `metric` (the mass matrix structure
 * adapted during warm-up: `'diag'` (default) estimates a per-dimension variance; `'dense'`
 * estimates the full covariance matrix, refactored through Matrix's LDL decomposition).
 * @param {Object=} options.initialState Initial state of the sampler (see MCMC base class).
 * @constructor
 * @throws {Error} If options is not a plain object, or gradLogDensity is not a function, or a
 * stepSize (config.stepSize or a resumed initialState.internal.stepSize) is provided but is not
 * a positive finite number, or metric is provided but is not `'diag'`/`'dense'`, or `'dense'` is
 * requested with a dimension exceeding the dense-metric cap, or a resumed
 * initialState.internal.metric does not match the resolved metric type/shape.
 */
// decisions/0020-mcmc-design.md — gradLogDensity is a NUTS-specific constructor argument, not
// threaded through the shared MCMC base constructor
// decisions/0025-hmc-iter-alpha-field.md — _iter returns an additional alpha field so _adjust can
// drive dual averaging; NUTS's alpha is the tree-averaged acceptance statistic, not a single
// leaf's Metropolis ratio (Hoffman & Gelman 2014 Algorithm 3)
// decisions/0031-gradient-sampler-options-object-constructor.md — establishes the
// {logDensity, gradLogDensity, config, initialState} options shape HMC also uses. NUTS has no
// prior release to stay backward compatible with (#972), so it ships options-object-only from
// day one, same as HMC after #968 removed HMC's own positional form.
// decisions/0032-mala-options-object-only-constructor.md — MALA's sibling migration (#970)
// establishes a guard-then-destructure pattern for options-object-only gradient samplers: a
// _validateOptions check runs before destructuring, so misuse (null, no args, or the old
// positional shape) throws a clear NUTS-specific error instead of a generic destructuring
// TypeError or an incidental "gradLogDensity must be a function" from the wrong root cause.
// NUTS follows the same pattern for consistency with its now-migrated sibling.
// decisions/0034-nuts-euclidean-metric-adaptation.md — Euclidean metric adaptation duplicates HMC's
// machinery (extraction deferred to follow-up #1041), uses an inline velocity-returning leapfrog,
// and evaluates the no-U-turn criterion on the velocity M^-1*r rather than the raw momentum
export default class NUTS extends MCMC {
  /**
   * @param {Object} options Sampler options, as a single object.
   * @param {Function} options.logDensity The logarithm of the (unnormalized) target density.
   * @param {Function} options.gradLogDensity The gradient of logDensity: maps a state (number[])
   * to its gradient (number[]) of the same dimension.
   * @param {Object=} options.config NUTS configuration (see MCMC base class for shared options),
   * plus `stepSize` (ε, the leapfrog step size, default 0.1) and `metric` (the mass matrix
   * structure adapted during warm-up: `'diag'` (default) or `'dense'`).
   * @param {Object=} options.initialState Initial state of the sampler (see MCMC base class).
   */
  constructor (options) {
    NUTS._validateOptions(options)
    const { logDensity, gradLogDensity, config = {}, initialState = {} } = options

    super(logDensity, config, initialState)

    NUTS._validateGradLogDensity(gradLogDensity)
    NUTS._validateStepSize(config.stepSize)
    // A resumed sampler's initialState.internal is caller-supplied the same way config is (e.g.
    // round-tripped through state()) — validating only config would let a corrupted/adversarial
    // internal.stepSize (e.g. Infinity) through unchecked.
    // See solutions/correctness/2026-07-15-1230-hmc-resumed-internal-state-validation-gap.md
    NUTS._validateStepSize(this.internal.stepSize)
    NUTS._validateMetric(config.metric)
    this._metricType = config.metric === 'dense' ? 'dense' : 'diag'
    NUTS._validateDenseMetricDim(this._metricType, this.dim)
    NUTS._validateResumedMetric(this.internal.metric, this._metricType, this.dim)
    NUTS._validateResumedMetricAccumulator(this.internal.metAccumulator, this._metricType, this.dim)

    this._gradLnp = gradLogDensity
    this._stepSize = this.internal.stepSize || config.stepSize || 0.1
    // Momentum component sampler, one Normal(0,1) draw per dimension per iteration; scaled by the
    // adapted metric in _sampleMomentum so momentum is drawn from N(0, M), not N(0, I). See
    // decisions/0034-nuts-euclidean-metric-adaptation.md.
    this._q = new Normal(0, 1)
    // decisions/0035-mcmc-exact-stream-reproducible-resume.md — restoring _q's own PRNG stream
    // is what makes resumed momentum draws bit-for-bit identical, not just statistically equivalent.
    MCMC._restoreQPrng(this._q, this.internal.prngQ, 'NUTS')
    this.lastLnp = this.lnp(this.x)

    this._restoreDualAveraging()
    this._initMetricState(this.internal.metric, this.internal.metAccumulator)
  }

  // ─── PUBLIC INSTANCE ───

  /**
   * Sets the seed for the sampler's pseudo random number generator, including the internal
   * momentum distribution's generator.
   *
   * @method seed
   * @memberof ran.mc.NUTS
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
    this._maybeFreezeStepSize(warmUp)

    const r0 = this._sampleMomentum()
    const h0 = this.lastLnp - this._kineticEnergy(r0)
    // log(u) for u ~ Uniform(0, exp(h0)): drawing log(u) directly avoids computing exp(h0), which
    // overflows/underflows long before the log-scale comparisons in _buildTree do.
    const logU = h0 + Math.log(this.r.next())
    const ctx = { logU, eps: this._stepSize, h0 }

    const { xNew, logPNew, alphaSum, nAlpha } = this._growTree(x, r0, ctx)
    const accepted = xNew !== x
    if (accepted) {
      this.lastLnp = logPNew
    }
    // nAlpha is always >= 1 here: _growTree's while loop runs at least once (MAX_TREE_DEPTH > 0),
    // and every _buildTree call bottoms out at a leaf that unconditionally contributes nAlpha: 1.
    return { x: xNew, accepted, alpha: alphaSum / nAlpha }
  }

  _adjust (i) {
    this._updateMetricAccumulator(i.x)
    if (this._metricType === 'dense') {
      if (this._metN >= 2 * this.dim && this._metN % NUTS._DENSE_METRIC_REFRESH_INTERVAL === 0) {
        this._refreshMetric()
      }
    } else if (this._metN >= 2 * this.dim) {
      // Statistical-quality gate, not a numerical-safety one (mirrors HMC/AdaptiveMetropolis's
      // identical 2*dim gate): EPS alone already keeps the variance away from exactly zero.
      // Refreshed every iteration since this path is O(dim), unlike the dense LDL refresh above.
      this._refreshMetric()
    }

    // Dual averaging is deliberately NOT reset when the metric changes above — the same documented
    // limitation HMC carries. See decisions/0029-hmc-euclidean-metric-adaptation.md §6 and
    // decisions/0034-nuts-euclidean-metric-adaptation.md: a literature-correct reset needs the
    // windowed warm-up schedule ADR-0024 rules out, and dual averaging's t^-kappa weighting fades
    // stale statistics as the metric settles.
    this._daT++
    // A NaN tree-averaged acceptance statistic (e.g. a hand-written gradient that returns NaN near a
    // support boundary instead of a rigorous -Infinity) would otherwise be sticky: it flows through
    // the Robbins-Monro recursion into _daHbar -> _daLogEpsBar -> stepSize and freezes the sampler
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
      // The effective, ready-to-use metric — restoration uses this directly so a resumed sampler's
      // momentum draws are correctly scaled even before the accumulator (below) next crosses its
      // own refresh gate.
      metric: this._metricType === 'dense'
        ? { type: 'dense', L: this._metL.map(row => row.slice()), D: this._metD.slice() }
        : { type: 'diag', variance: this._metVar.slice() },
      prngQ: this._q.r.save(),
      daMu: this._daMu,
      daHbar: this._daHbar,
      daLogEpsBar: this._daLogEpsBar,
      daT: this._daT,
      // Raw mass-matrix accumulator (distinct from the effective metric above) — see
      // decisions/0035-mcmc-exact-stream-reproducible-resume.md.
      metAccumulator: this._metricType === 'dense'
        ? { metN: this._metN, metMean: this._metMean.slice(), metCovS: this._metCovS.map(row => row.slice()) }
        : { metN: this._metN, metMean: this._metMean.slice(), metM2: this._metM2.slice() }
    }
  }

  // ─── PRIVATE INSTANCE ───

  // Mirrors HMC's _iter freeze logic (hmc.js): switch from the actively-adapting exploration step
  // size to the dual-averaging-smoothed value on the first post-warm-up iteration, and reset the
  // shrinkage target so a later warmUp() call (after sample()) adapts from the tuned step size
  // rather than pulling back toward the original construction-time epsilon. Kept out of _iter to
  // avoid a Complex Method smell there. Unlike HMC, NUTS does not jitter eps — its trajectory
  // length and direction are already randomized per iteration, so the periodicity artifacts jitter
  // guards against do not arise here.
  _maybeFreezeStepSize (warmUp) {
    if (!warmUp && this._daT > 0) {
      this._stepSize = Math.exp(this._daLogEpsBar)
      this._daMu = Math.log(10 * this._stepSize)
      this._daT = 0
    }
  }

  // The doubling loop (Hoffman & Gelman 2014, Algorithm 3's main iteration): repeatedly extends
  // the trajectory backward or forward in a random direction via _buildTree, accepts the returned
  // candidate into xNew with probability min(1, n'/n), and accumulates the tree-averaged
  // acceptance statistic (alphaSum/nAlpha) that _adjust needs for dual averaging. Stops on a
  // U-turn across the full current span or at MAX_TREE_DEPTH. Kept out of _iter to avoid a
  // Complex Method smell there.
  _growTree (x, r0, ctx) {
    // The no-U-turn criterion is evaluated on the velocity M^-1*r, not the raw momentum r, so the
    // outer endpoints carry their velocities alongside their momenta. For the identity metric the
    // two coincide, keeping behavior bitwise-identical to the pre-metric sampler. See
    // decisions/0034-nuts-euclidean-metric-adaptation.md.
    const v0 = this._applyInverseMetric(r0)
    let xMinus = x
    let rMinus = r0
    let velMinus = v0
    let xPlus = x
    let rPlus = r0
    let velPlus = v0
    let xNew = x
    let logPNew = this.lastLnp
    let n = 1
    let s = 1
    let alphaSum = 0
    let nAlpha = 0
    let j = 0

    while (s === 1 && j < MAX_TREE_DEPTH) {
      const v = this.r.next() < 0.5 ? -1 : 1
      const subtree = this._buildTree(v === -1 ? { x: xMinus, r: rMinus } : { x: xPlus, r: rPlus }, v, j, ctx)
      if (v === -1) {
        xMinus = subtree.xMinus
        rMinus = subtree.rMinus
        velMinus = subtree.velMinus
      } else {
        xPlus = subtree.xPlus
        rPlus = subtree.rPlus
        velPlus = subtree.velPlus
      }
      if (subtree.sPrime === 1 && this.r.next() < Math.min(1, subtree.nPrime / n)) {
        xNew = subtree.xPrime
        logPNew = subtree.logPPrime
      }
      n += subtree.nPrime
      alphaSum += subtree.alphaSum
      nAlpha += subtree.nAlpha
      s = subtree.sPrime * NUTS._noUTurn(xMinus, velMinus, xPlus, velPlus)
      j++
    }

    return { xNew, logPNew, alphaSum, nAlpha }
  }

  // Recursive doubling-tree builder (Hoffman & Gelman 2014, Algorithm 3's BuildTree). Recursion
  // depth is bounded by MAX_TREE_DEPTH (<= 10), well within any JS engine's stack limit. `node` is
  // the {x, r} pair the caller is extending from; `ctx` bundles the per-iteration constants
  // ({logU, eps, h0}) threaded unchanged through every recursive call — both grouped into single
  // objects to keep the argument count within the codebase's convention.
  _buildTree (node, v, j, ctx) {
    return j === 0 ? this._buildTreeLeaf(node, v, ctx) : this._buildTreeBranch(node, v, j, ctx)
  }

  // Base case: one signed leapfrog step, checked against the slice (nPrime) and the
  // energy-divergence guard (sPrime).
  _buildTreeLeaf (node, v, ctx) {
    const { x: xp, r: rp, vel: velp } = this._leapfrog(node.x, node.r, v * ctx.eps)
    const logPp = this.lnp(xp)
    const h = logPp - this._kineticEnergy(rp)
    const alphaSum = Math.min(1, Math.exp(h - ctx.h0))
    return {
      xMinus: xp,
      rMinus: rp,
      velMinus: velp,
      xPlus: xp,
      rPlus: rp,
      velPlus: velp,
      xPrime: xp,
      logPPrime: logPp,
      nPrime: ctx.logU <= h ? 1 : 0,
      sPrime: ctx.logU < DELTA_MAX + h ? 1 : 0,
      alphaSum,
      nAlpha: 1
    }
  }

  // Recursive case: builds one subtree at depth j-1, and, if it did not already signal a stop, a
  // second subtree continuing in the same direction from the new outer endpoint; combines both
  // into the returned span, candidate, and accumulators.
  _buildTreeBranch (node, v, j, ctx) {
    const first = this._buildTree(node, v, j - 1, ctx)
    if (first.sPrime === 0) {
      return first
    }

    const continuation = v === -1 ? { x: first.xMinus, r: first.rMinus } : { x: first.xPlus, r: first.rPlus }
    const second = this._buildTree(continuation, v, j - 1, ctx)
    return this._combineSubtrees(first, second, v)
  }

  // Merges two subtrees built in the same direction: the outer span, a probabilistically-selected
  // candidate (weighted by each subtree's valid-point count), the combined U-turn flag, and the
  // summed alpha/n accumulators.
  _combineSubtrees (first, second, v) {
    // Extending backward (v=-1) puts the outer minus endpoint at `second`'s far side and keeps
    // `first`'s plus endpoint; extending forward is the mirror image. `minus`/`plus` reference the
    // subtree that owns each outer endpoint (no copy), so its x/r/vel are read directly.
    const minus = v === -1 ? second : first
    const plus = v === -1 ? first : second

    const nPrime = first.nPrime + second.nPrime
    const pickSecond = nPrime > 0 && this.r.next() < second.nPrime / nPrime
    const chosen = pickSecond ? second : first

    return {
      xMinus: minus.xMinus,
      rMinus: minus.rMinus,
      velMinus: minus.velMinus,
      xPlus: plus.xPlus,
      rPlus: plus.rPlus,
      velPlus: plus.velPlus,
      xPrime: chosen.xPrime,
      logPPrime: chosen.logPPrime,
      nPrime,
      sPrime: second.sPrime * NUTS._noUTurn(minus.xMinus, minus.velMinus, plus.xPlus, plus.velPlus),
      alphaSum: first.alphaSum + second.alphaSum,
      nAlpha: first.nAlpha + second.nAlpha
    }
  }

  // Single metric-aware leapfrog step (Neal 2011, Algorithm 1): half-step momentum, full-step
  // position using the velocity M^-1*r, half-step momentum. NUTS's tree always takes one step per
  // leaf, so this is fixed at steps=1 with direction folded into a signed eps. Returns the endpoint
  // velocity `vel` (= M^-1*r at the new momentum) alongside x and r, since the no-U-turn criterion
  // needs it and this method already computes M^-1*r. Deliberately NUTS-private and inline (mirrors
  // HMC's own inline leapfrog) rather than a shared module, so the metric is applied without
  // contorting a shared integrator's interface. See decisions/0034-nuts-euclidean-metric-adaptation.md.
  _leapfrog (x, r, eps) {
    const xCur = x.slice()
    const rCur = r.slice()
    const n = xCur.length
    const grad0 = this._gradLnp(xCur)
    for (let i = 0; i < n; i++) {
      rCur[i] += 0.5 * eps * grad0[i]
    }
    const vMid = this._applyInverseMetric(rCur)
    for (let i = 0; i < n; i++) {
      xCur[i] += eps * vMid[i]
    }
    const grad1 = this._gradLnp(xCur)
    for (let i = 0; i < n; i++) {
      rCur[i] += 0.5 * eps * grad1[i]
    }
    return { x: xCur, r: rCur, vel: this._applyInverseMetric(rCur) }
  }

  // Sets up the mass-matrix (metric) online accumulator and the effective (ready-to-use) metric
  // consulted by _sampleMomentum/_applyInverseMetric. Structurally mirrors HMC. Extracted out of
  // the constructor to avoid a Complex Method smell there. Extraction of this machinery into a
  // shared module (deduplicating HMC and NUTS) is a deferred follow-up — see
  // decisions/0034-nuts-euclidean-metric-adaptation.md.
  _initMetricState (resumedMetric, resumedAccumulator) {
    this._initMetricAccumulator(resumedAccumulator)
    this._initEffectiveMetric(resumedMetric)
  }

  // `resumed` (decisions/0035-mcmc-exact-stream-reproducible-resume.md) restores the raw
  // accumulator so a mid-warm-up resume's next refresh reads the same history the uninterrupted
  // chain would have; deep-copies metCovS (a dim x dim nested array) so the live accumulator
  // never aliases a caller-held snapshot's rows. Mirrors HMC's identical accumulator restore.
  _initMetricAccumulator (resumed) {
    this._metN = MCMC._resolveResumedField(resumed, 'metN', 0)
    this._metMean = MCMC._resolveResumedField(resumed, 'metMean', new Array(this.dim).fill(0)).slice()
    if (this._metricType === 'dense') {
      this._metCovS = MCMC._resolveResumedField(
        resumed, 'metCovS', Array.from({ length: this.dim }, () => new Array(this.dim).fill(0))
      ).map(row => row.slice())
      this._metDelta = new Array(this.dim).fill(0)
      this._metDelta2 = new Array(this.dim).fill(0)
      this._zBuffer = new Array(this.dim).fill(0)
    } else {
      this._metM2 = MCMC._resolveResumedField(resumed, 'metM2', new Array(this.dim).fill(0)).slice()
    }
  }

  // Seeded from a resumed state or the identity default -- kept separate from the accumulator so a
  // resumed sampler uses its adapted metric immediately without waiting for _metN to re-cross the
  // refresh gate.
  _initEffectiveMetric (resumedMetric) {
    if (this._metricType === 'dense') {
      this._metL = resumedMetric ? resumedMetric.L.map(row => row.slice()) : NUTS._identityRows(this.dim)
      this._metD = resumedMetric ? resumedMetric.D.slice() : new Array(this.dim).fill(1)
    } else {
      this._metVar = resumedMetric ? resumedMetric.variance.slice() : new Array(this.dim).fill(1)
    }
  }

  // Online (Welford-style) update of the metric accumulator, fed the post-accept/reject state per
  // _adjust's contract. Entirely private to NUTS -- deliberately not reusing MCMC's own _welford
  // accumulator (contractual per decisions/0023-mcmc-accumulator-mechanics.md), mirroring HMC.
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

  // Refactorizes the effective metric from the accumulator. Diagonal: elementwise sample variance +
  // EPS. Dense: Cov(x) + EPS*I via a transient Matrix, decomposed via ldl() and extracted to plain
  // arrays -- the Matrix instance never becomes a field (see
  // solutions/tooling/2026-07-15-1330-adaptive-metropolis-ran-la-matrix-dts-leak.md).
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

  // Draws momentum p ~ N(0, M). The mass matrix is the *precision*, M = Sigma^-1, where Sigma is the
  // estimated covariance/variance (decisions/0029-hmc-euclidean-metric-adaptation.md): a LARGER
  // estimated variance means a MORE CONCENTRATED momentum distribution, so the metric compensates
  // for wide target directions. Diagonal: elementwise. Dense: Sigma = L*D*L^T (from ldl()), and
  // p ~ N(0, Sigma^-1) is drawn as p solving L^T*p = z/sqrt(D) via back substitution. For the
  // identity default (variance all ones) this draws _q.sample()/sqrt(1) in the same order as the
  // pre-metric sampler, keeping behavior bitwise-identical.
  // M and M^-1 are easy to swap here -- see solutions/correctness/2026-07-16-1422-hmc-mass-matrix-precision-inversion.md
  _sampleMomentum () {
    if (this._metricType === 'dense') {
      for (let i = 0; i < this.dim; i++) {
        this._zBuffer[i] = this._q.sample()
      }
      const u = this._zBuffer.map((z, i) => z / Math.sqrt(this._metD[i]))
      return NUTS._backSubstituteTranspose(this._metL, u)
    }
    return Array.from({ length: this.dim }, (_, i) => this._q.sample() / Math.sqrt(this._metVar[i]))
  }

  // Computes M^-1 * p (the velocity), needed for the leapfrog position update, the kinetic energy,
  // and the no-U-turn check. Since M = Sigma^-1 (the precision), M^-1 * p = Sigma * p directly.
  // Diagonal: elementwise. Dense: Sigma * p = L*D*L^T*p as three plain matrix-vector products.
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

  // Kept out of the constructor to avoid a Complex Conditional / Complex Method smell there.
  // Destructuring options directly in the constructor's parameter list would throw a generic,
  // engine-dependent TypeError for null (default parameters only cover undefined) or the old
  // positional shape, instead of this clear, NUTS-specific message.
  // See solutions/correctness/2026-07-18-1147-mala-null-guard-destructured-parameter-gap.md
  static _validateOptions (options) {
    if (!NUTS._isPlainObject(options)) {
      throw Error('NUTS: constructor requires an options object: new NUTS({ logDensity, gradLogDensity, config, initialState })')
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
      throw Error('NUTS: gradLogDensity must be a function')
    }
  }

  // Kept out of the constructor to avoid a Complex Conditional / Complex Method smell there.
  static _validateStepSize (stepSize) {
    if (stepSize === undefined) {
      return
    }
    if (!(Number.isFinite(stepSize) && stepSize > 0)) {
      throw Error('NUTS: stepSize must be a positive number')
    }
  }

  // No-U-turn check (Hoffman & Gelman 2014): the trajectory's outer endpoints are still expanding
  // apart, not curving back toward each other, along both the backward and forward VELOCITIES.
  // Under a non-identity metric the dot product must use the velocity M^-1*r, not the raw momentum
  // r (Betancourt 2017; Stan's adapt_*_e_nuts) — dotting raw momentum instead silently mis-tunes
  // trajectory length on ill-scaled targets while still passing KS tests on well-scaled ones. See
  // decisions/0034-nuts-euclidean-metric-adaptation.md and
  // solutions/correctness/2026-07-19-1250-nuts-uturn-velocity-not-momentum.md. Single pass over both dot products (rather
  // than a mapped difference array plus two reduces) — called up to ~1000 times per NUTS iteration.
  static _noUTurn (xMinus, velMinus, xPlus, velPlus) {
    let dotMinus = 0
    let dotPlus = 0
    for (let i = 0; i < xPlus.length; i++) {
      const dx = xPlus[i] - xMinus[i]
      dotMinus += dx * velMinus[i]
      dotPlus += dx * velPlus[i]
    }
    return (dotMinus >= 0 && dotPlus >= 0) ? 1 : 0
  }

  // Kept out of the constructor to avoid a Complex Conditional / Complex Method smell there.
  static _validateMetric (metric) {
    if (metric === undefined) {
      return
    }
    if (metric !== 'diag' && metric !== 'dense') {
      throw Error("NUTS: metric must be 'diag' or 'dense'")
    }
  }

  // A dense metric's covariance accumulator and LDL factor are both dim*dim -- MCMC's own
  // _validateCombinedFootprint only bounds dim*maxLag (the autocorrelation buffers), so it does not
  // itself catch a dense-metric blowup at MCMC._MAX_DIM = 10000 (~800MB). Mirrors HMC's identical
  // guard. See decisions/0029-hmc-euclidean-metric-adaptation.md.
  static _validateDenseMetricDim (metricType, dim) {
    if (metricType === 'dense' && dim > NUTS._MAX_DENSE_METRIC_DIM) {
      throw Error(`NUTS: metric: 'dense' requires dim to be at most ${NUTS._MAX_DENSE_METRIC_DIM}`)
    }
  }

  // A resumed initialState.internal.metric is caller-supplied the same way config is -- see the
  // stepSize validation above and
  // solutions/correctness/2026-07-15-1230-hmc-resumed-internal-state-validation-gap.md. Kept out of
  // the constructor to avoid a Complex Conditional / Complex Method smell there.
  static _validateResumedMetric (metric, metricType, dim) {
    if (metric === undefined) {
      return
    }
    if (metric.type !== metricType) {
      throw Error('NUTS: resumed metric type does not match the resolved metric')
    }
    if (metricType === 'dense') {
      NUTS._validateResumedDenseMetric(metric, dim)
    } else {
      NUTS._validateResumedDiagMetric(metric, dim)
    }
  }

  static _validateResumedDiagMetric (metric, dim) {
    if (!NUTS._isPositiveFiniteVector(metric.variance, dim)) {
      throw Error('NUTS: resumed metric.variance must be an array of dim positive finite numbers')
    }
  }

  static _validateResumedDenseMetric (metric, dim) {
    if (!NUTS._isPositiveFiniteVector(metric.D, dim)) {
      throw Error('NUTS: resumed metric.D must be an array of dim positive finite numbers')
    }
    if (!NUTS._isFiniteMatrix(metric.L, dim)) {
      throw Error('NUTS: resumed metric.L must be a dim x dim array of finite numbers')
    }
  }

  // A resumed initialState.internal.metAccumulator is caller-supplied the same way metric is
  // above -- see solutions/correctness/2026-07-15-1230-hmc-resumed-internal-state-validation-gap.md.
  // Kept out of the constructor to avoid a Complex Conditional / Complex Method smell there.
  // Mirrors HMC's identical accumulator validator.
  static _validateResumedMetricAccumulator (resumed, metricType, dim) {
    if (resumed === undefined) {
      return
    }
    MCMC._validateNonNegativeInteger(resumed.metN, 'NUTS: resumed metAccumulator.metN')
    MCMC._validateFiniteVector(resumed.metMean, dim, 'NUTS: resumed metAccumulator.metMean')
    if (metricType === 'dense') {
      MCMC._validateFiniteMatrix(resumed.metCovS, dim, 'NUTS: resumed metAccumulator.metCovS')
    } else {
      MCMC._validateFiniteVector(resumed.metM2, dim, 'NUTS: resumed metAccumulator.metM2')
    }
  }

  static _isFiniteVector (arr, length) {
    return Array.isArray(arr) && arr.length === length && arr.every(Number.isFinite)
  }

  static _isPositiveFiniteVector (arr, length) {
    return NUTS._isFiniteVector(arr, length) && arr.every(v => v > 0)
  }

  static _isFiniteMatrix (rows, dim) {
    return Array.isArray(rows) && rows.length === dim && rows.every(row => NUTS._isFiniteVector(row, dim))
  }

  static get _MAX_DENSE_METRIC_DIM () {
    return 1000
  }

  // Matrix.ldl() is O(dim^3); refreshing the dense metric every iteration (as the diagonal case and
  // AdaptiveMetropolis both do cheaply) would make dense warm-up cost scale with O(dim^3) *
  // iterations. This interval is a fixed, non-configurable NUTS constant, deliberately decoupled
  // from MCMC.warmUp()'s own internal batch size so a future change to one cannot silently change
  // the other's behavior. Mirrors HMC. See decisions/0029-hmc-euclidean-metric-adaptation.md.
  static get _DENSE_METRIC_REFRESH_INTERVAL () {
    return 1000
  }

  // Dense metric's identity default (no observations yet to base a covariance estimate on).
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
