import MCMC from './_mcmc'
import { Normal } from '../dist'
import {
  createMetricState, updateAccumulator, refreshMetric, sampleMomentum, applyInverseMetric,
  kineticEnergy, snapshotMetric, snapshotAccumulator, validateMetric, validateDenseMetricDim,
  validateResumedMetric, validateResumedMetricAccumulator, DENSE_METRIC_REFRESH_INTERVAL
} from './_metric'

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
 * Sampler-health diagnostics are exposed both per-transition and in aggregate: every
 * [iterate]{@link ran.mc.MCMC#iterate} result carries `divergent` and `maxDepthHit` booleans, and
 * [divergenceCount]{@link ran.mc.NUTS#divergenceCount} / [maxDepthCount]{@link ran.mc.NUTS#maxDepthCount}
 * report the per-sampling-phase totals (reset like [ar]{@link ran.mc.MCMC#ar}). A well-behaved run
 * reports both counts as 0; nonzero divergences flag a step size that is too large or a target too
 * extreme, nonzero max-depth hits a step size that is too small. See
 * decisions/0035-nuts-sampler-health-diagnostics.md.
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
// decisions/0034-nuts-euclidean-metric-adaptation.md — Euclidean metric adaptation, an inline
// velocity-returning leapfrog, and the no-U-turn criterion evaluated on the velocity M^-1*r rather
// than the raw momentum
// decisions/0036-shared-metric-module.md — the accumulator/refresh/momentum/validator machinery now
// lives in the shared ./_metric module (extraction of HMC's and NUTS's former duplicates, #1041)
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
    validateMetric('NUTS', config.metric)
    this._metricType = config.metric === 'dense' ? 'dense' : 'diag'
    validateDenseMetricDim('NUTS', this._metricType, this.dim)
    validateResumedMetric('NUTS', this.internal.metric, this._metricType, this.dim)
    validateResumedMetricAccumulator('NUTS', this.internal.metAccumulator, this._metricType, this.dim)

    this._gradLnp = gradLogDensity
    this._stepSize = this.internal.stepSize || config.stepSize || 0.1
    // Momentum component sampler, one Normal(0,1) draw per dimension per iteration; scaled by the
    // adapted metric in sampleMomentum (./_metric) so momentum is drawn from N(0, M), not N(0, I).
    // See decisions/0034-nuts-euclidean-metric-adaptation.md.
    this._q = new Normal(0, 1)
    // decisions/0035-mcmc-exact-stream-reproducible-resume.md — restoring _q's own PRNG stream
    // is what makes resumed momentum draws bit-for-bit identical, not just statistically equivalent.
    MCMC._restoreQPrng(this._q, this.internal.prngQ, 'NUTS')
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

  /**
   * Returns the number of divergent transitions recorded during the current sampling phase. A
   * divergent transition is one whose leapfrog trajectory contained a leaf whose Hamiltonian drifted
   * more than the energy-divergence threshold from the trajectory's start, indicating the step size
   * is too large or the target geometry too extreme (biased exploration). Reset at construction and
   * at the start of each [sample]{@link ran.mc.MCMC#sample} call, so a read afterwards reflects the
   * sampling phase only — the same lifecycle as [ar]{@link ran.mc.MCMC#ar}. A well-behaved run reports 0.
   *
   * @method divergenceCount
   * @memberof ran.mc.NUTS
   * @returns {number} Count of divergent transitions since the last reset.
   */
  // decisions/0035-nuts-sampler-health-diagnostics.md — divergences surfaced as a per-phase count
  divergenceCount () {
    return this._divergenceCount
  }

  /**
   * Returns the number of transitions that reached the maximum tree depth during the current sampling
   * phase. A max-depth hit is a doubling that exhausted the tree-depth cap without the trajectory
   * U-turning, indicating the step size is too small (inefficient sampling). Reset at construction and
   * at the start of each [sample]{@link ran.mc.MCMC#sample} call, so a read afterwards reflects the
   * sampling phase only — the same lifecycle as [ar]{@link ran.mc.MCMC#ar}. A well-behaved run reports 0.
   *
   * @method maxDepthCount
   * @memberof ran.mc.NUTS
   * @returns {number} Count of max-tree-depth-saturated transitions since the last reset.
   */
  // decisions/0035-nuts-sampler-health-diagnostics.md — max-depth saturation surfaced as a per-phase count
  maxDepthCount () {
    return this._maxDepthCount
  }

  // ─── PROTECTED INSTANCE ───

  _iter (x, warmUp) {
    this._maybeFreezeStepSize(warmUp)

    const r0 = sampleMomentum(this._met, this._q)
    const h0 = this.lastLnp - kineticEnergy(this._met, r0)
    // log(u) for u ~ Uniform(0, exp(h0)): drawing log(u) directly avoids computing exp(h0), which
    // overflows/underflows long before the log-scale comparisons in _buildTree do.
    const logU = h0 + Math.log(this.r.next())
    const ctx = { logU, eps: this._stepSize, h0 }

    const { xNew, logPNew, alphaSum, nAlpha, divergent, maxDepthHit } = this._growTree(x, r0, ctx)
    const accepted = xNew !== x
    if (accepted) {
      this.lastLnp = logPNew
    }
    // Sampler-health counters ride the ADR-0023 accumulator lifecycle: incremented once per iteration
    // here (in both phases), reset only by _initAccumulators (construction + sample() start), so a
    // read after sample() reflects the sampling phase — exactly how ar() behaves. Booleans are also
    // returned per-transition so iterate() callers can inspect each step.
    this._divergenceCount += divergent ? 1 : 0
    this._maxDepthCount += maxDepthHit ? 1 : 0
    // nAlpha is always >= 1 here: _growTree's while loop runs at least once (MAX_TREE_DEPTH > 0),
    // and every _buildTree call bottoms out at a leaf that unconditionally contributes nAlpha: 1.
    return { x: xNew, accepted, alpha: alphaSum / nAlpha, divergent, maxDepthHit }
  }

  _adjust (i) {
    updateAccumulator(this._met, i.x)
    if (this._metricType === 'dense') {
      if (this._met.metN >= 2 * this.dim && this._met.metN % DENSE_METRIC_REFRESH_INTERVAL === 0) {
        refreshMetric(this._met)
      }
    } else if (this._met.metN >= 2 * this.dim) {
      // Statistical-quality gate, not a numerical-safety one (mirrors HMC/AdaptiveMetropolis's
      // identical 2*dim gate): EPS alone already keeps the variance away from exactly zero.
      // Refreshed every iteration since this path is O(dim), unlike the dense LDL refresh above.
      refreshMetric(this._met)
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
      metric: snapshotMetric(this._met),
      prngQ: this._q.r.save(),
      daMu: this._daMu,
      daHbar: this._daHbar,
      daLogEpsBar: this._daLogEpsBar,
      daT: this._daT,
      metAccumulator: snapshotAccumulator(this._met)
    }
  }

  // ─── PRIVATE INSTANCE ───

  // Overrides the base accumulator reset to also zero the NUTS-local sampler-health counters, so they
  // ride the ADR-0023 lifecycle (reset at construction and sample() start, never between/within
  // warm-up) — first subclass to override this hook. Reads no NUTS-specific field, so it is safe under
  // the base constructor's virtual-dispatch call before this subclass's constructor body runs.
  // decisions/0035-nuts-sampler-health-diagnostics.md, decisions/0023-mcmc-accumulator-mechanics.md
  _initAccumulators () {
    super._initAccumulators()
    this._divergenceCount = 0
    this._maxDepthCount = 0
  }

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
    const v0 = applyInverseMetric(this._met, r0)
    let xMinus = x
    let rMinus = r0
    let velMinus = v0
    let xPlus = x
    let rPlus = r0
    let velPlus = v0
    let candidate = { x, logP: this.lastLnp }
    let n = 1
    let s = 1
    let alphaSum = 0
    let nAlpha = 0
    let j = 0
    let divergent = false

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
      candidate = this._selectCandidate(subtree, n, candidate)
      n += subtree.nPrime
      alphaSum += subtree.alphaSum
      nAlpha += subtree.nAlpha
      divergent = divergent || subtree.divergent
      s = subtree.sPrime * NUTS._noUTurn(xMinus, velMinus, xPlus, velPlus)
      j++
    }

    // Saturation is the loop exhausting all MAX_TREE_DEPTH doublings with no stopping condition
    // (s === 1). The s === 1 conjunct excludes a U-turn/divergence that stops the loop exactly at the
    // last allowed doubling — there the trajectory was satisfied, not artificially capped.
    const maxDepthHit = j === MAX_TREE_DEPTH && s === 1

    return { xNew: candidate.x, logPNew: candidate.logP, alphaSum, nAlpha, divergent, maxDepthHit }
  }

  // Probabilistically replaces the running candidate with the subtree's proposal, weighted by
  // min(1, n'/n) over the subtree's valid-point count (Hoffman & Gelman 2014, Algorithm 3). Extracted
  // from _growTree to keep that method's cyclomatic complexity within the codebase threshold. Returns
  // the passed-in candidate object unchanged on rejection (no allocation on the common reject path;
  // a fresh object only when the proposal is accepted), and the this.r.next() draw stays inside the
  // same short-circuit so the RNG order — and thus the bitwise-reproducible .seed() stream — is unchanged.
  _selectCandidate (subtree, n, candidate) {
    if (subtree.sPrime === 1 && this.r.next() < Math.min(1, subtree.nPrime / n)) {
      return { x: subtree.xPrime, logP: subtree.logPPrime }
    }
    return candidate
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
    const h = logPp - kineticEnergy(this._met, rp)
    const alphaSum = Math.min(1, Math.exp(h - ctx.h0))
    // At a leaf there is no U-turn check, so sPrime === 0 here is *exclusively* the energy-divergence
    // guard — the sole origin of the divergent diagnostic threaded up the tree. Higher in the tree
    // sPrime also absorbs U-turn stops, so divergence must be carried in its own flag rather than
    // re-derived from sPrime. See decisions/0035-nuts-sampler-health-diagnostics.md and
    // solutions/correctness/2026-07-19-1456-nuts-diagnostics-overloaded-sprime-signal.md.
    const withinEnergyBound = ctx.logU < DELTA_MAX + h
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
      sPrime: withinEnergyBound ? 1 : 0,
      divergent: !withinEnergyBound,
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
      // The U-turn factor above zeroes sPrime without implying divergence, so divergent is OR-merged
      // independently of sPrime — a diverged leaf anywhere in either subtree marks the whole span.
      divergent: first.divergent || second.divergent,
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
    const vMid = applyInverseMetric(this._met, rCur)
    for (let i = 0; i < n; i++) {
      xCur[i] += eps * vMid[i]
    }
    const grad1 = this._gradLnp(xCur)
    for (let i = 0; i < n; i++) {
      rCur[i] += 0.5 * eps * grad1[i]
    }
    return { x: xCur, r: rCur, vel: applyInverseMetric(this._met, rCur) }
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
}
