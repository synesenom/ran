import MCMC from './_mcmc'
import { Normal } from '../dist'
import leapfrog from './_leapfrog'

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
 * length. Momenta are resampled from a standard multivariate Normal at the start of every
 * iteration. During warm-up, the step size is adapted via Robbins-Monro dual averaging (Hoffman &
 * Gelman 2014, S3.2) toward a target acceptance probability, driven by the tree-averaged
 * acceptance statistic accumulated across every leapfrog evaluation in that iteration's tree.
 *
 * @class NUTS
 * @memberof ran.mc
 * @param {Object} options Sampler options, as a single object.
 * @param {Function} options.logDensity The logarithm of the (unnormalized) target density.
 * @param {Function} options.gradLogDensity The gradient of logDensity: maps a state (number[]) to
 * its gradient (number[]) of the same dimension.
 * @param {Object=} options.config NUTS configuration (see MCMC base class for shared options),
 * plus `stepSize` (ε, the leapfrog step size, default 0.1).
 * @param {Object=} options.initialState Initial state of the sampler (see MCMC base class).
 * @constructor
 * @throws {Error} If gradLogDensity is not a function, or a stepSize (config.stepSize or a
 * resumed initialState.internal.stepSize) is provided but is not a positive finite number.
 */
// decisions/0020-mcmc-design.md — gradLogDensity is a NUTS-specific constructor argument, not
// threaded through the shared MCMC base constructor
// decisions/0025-hmc-iter-alpha-field.md — _iter returns an additional alpha field so _adjust can
// drive dual averaging; NUTS's alpha is the tree-averaged acceptance statistic, not a single
// leaf's Metropolis ratio (Hoffman & Gelman 2014 Algorithm 3)
// decisions/0031-gradient-sampler-options-object-constructor.md — establishes the
// {logDensity, gradLogDensity, config, initialState} options shape HMC resolves via
// MCMC._resolveGradientSamplerArgs. NUTS has no prior release to stay backward compatible with
// (#972), so it ships options-object-only: no positional form, no deprecation warning, and no
// call to _resolveGradientSamplerArgs (that resolver always warns on its positional branch,
// which would be wrong here since NUTS never had one).
export default class NUTS extends MCMC {
  /**
   * @param {Object} options Sampler options, as a single object.
   * @param {Function} options.logDensity The logarithm of the (unnormalized) target density.
   * @param {Function} options.gradLogDensity The gradient of logDensity: maps a state (number[])
   * to its gradient (number[]) of the same dimension.
   * @param {Object=} options.config NUTS configuration (see MCMC base class for shared options),
   * plus `stepSize` (ε, the leapfrog step size, default 0.1).
   * @param {Object=} options.initialState Initial state of the sampler (see MCMC base class).
   */
  constructor ({ logDensity, gradLogDensity, config = {}, initialState = {} } = {}) {
    super(logDensity, config, initialState)

    NUTS._validateGradLogDensity(gradLogDensity)
    NUTS._validateStepSize(config.stepSize)
    // A resumed sampler's initialState.internal is caller-supplied the same way config is (e.g.
    // round-tripped through state()) — validating only config would let a corrupted/adversarial
    // internal.stepSize (e.g. Infinity) through unchecked.
    // See solutions/correctness/2026-07-15-1230-hmc-resumed-internal-state-validation-gap.md
    NUTS._validateStepSize(this.internal.stepSize)

    this._gradLnp = gradLogDensity
    this._stepSize = this.internal.stepSize || config.stepSize || 0.1
    // Momentum component sampler, one Normal(0,1) draw per dimension per iteration. Identity mass
    // matrix — Euclidean metric adaptation is out of scope (issue #826).
    this._q = new Normal(0, 1)
    this.lastLnp = this.lnp(this.x)

    // Dual-averaging state (Hoffman & Gelman 2014 S3.2): mu is the shrinkage target, Hbar the
    // running acceptance-probability-deviation statistic, logEpsBar the smoothed log step size,
    // t the iteration counter. Ephemeral — not part of _internal()'s serialized state, matching
    // HMC's precedent of serializing only the effective proposal scale.
    this._daMu = Math.log(10 * this._stepSize)
    this._daHbar = 0
    this._daLogEpsBar = Math.log(this._stepSize)
    this._daT = 0
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

    const r0 = Array.from({ length: this.dim }, () => this._q.sample())
    const h0 = this.lastLnp - 0.5 * r0.reduce((s, ri) => s + ri * ri, 0)
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
    this._daT++
    this._daHbar = (1 - 1 / (this._daT + T0)) * this._daHbar + (1 / (this._daT + T0)) * (DELTA - i.alpha)
    const logEps = this._daMu - (Math.sqrt(this._daT) / GAMMA) * this._daHbar
    const w = Math.pow(this._daT, -KAPPA)
    this._daLogEpsBar = w * logEps + (1 - w) * this._daLogEpsBar
    this._stepSize = Math.exp(logEps)
  }

  _internal () {
    return { stepSize: this._stepSize }
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
    let xMinus = x
    let rMinus = r0
    let xPlus = x
    let rPlus = r0
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
      } else {
        xPlus = subtree.xPlus
        rPlus = subtree.rPlus
      }
      if (subtree.sPrime === 1 && this.r.next() < Math.min(1, subtree.nPrime / n)) {
        xNew = subtree.xPrime
        logPNew = subtree.logPPrime
      }
      n += subtree.nPrime
      alphaSum += subtree.alphaSum
      nAlpha += subtree.nAlpha
      s = subtree.sPrime * NUTS._noUTurn(xMinus, rMinus, xPlus, rPlus)
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
    const { x: xp, r: rp } = leapfrog(node.x, node.r, this._gradLnp, v * ctx.eps, 1)
    const logPp = this.lnp(xp)
    const h = logPp - 0.5 * rp.reduce((s, ri) => s + ri * ri, 0)
    const alphaSum = Math.min(1, Math.exp(h - ctx.h0))
    return {
      xMinus: xp,
      rMinus: rp,
      xPlus: xp,
      rPlus: rp,
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
    const xMinus = v === -1 ? second.xMinus : first.xMinus
    const rMinus = v === -1 ? second.rMinus : first.rMinus
    const xPlus = v === -1 ? first.xPlus : second.xPlus
    const rPlus = v === -1 ? first.rPlus : second.rPlus

    const nPrime = first.nPrime + second.nPrime
    const pickSecond = nPrime > 0 && this.r.next() < second.nPrime / nPrime

    return {
      xMinus,
      rMinus,
      xPlus,
      rPlus,
      xPrime: pickSecond ? second.xPrime : first.xPrime,
      logPPrime: pickSecond ? second.logPPrime : first.logPPrime,
      nPrime,
      sPrime: second.sPrime * NUTS._noUTurn(xMinus, rMinus, xPlus, rPlus),
      alphaSum: first.alphaSum + second.alphaSum,
      nAlpha: first.nAlpha + second.nAlpha
    }
  }

  // ─── PRIVATE STATIC ───

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
  // apart, not curving back toward each other, along both the backward and forward momenta. Single
  // pass over both dot products (rather than a mapped difference array plus two reduces) — called
  // up to ~1000 times per NUTS iteration.
  static _noUTurn (xMinus, rMinus, xPlus, rPlus) {
    let dotMinus = 0
    let dotPlus = 0
    for (let i = 0; i < xPlus.length; i++) {
      const dx = xPlus[i] - xMinus[i]
      dotMinus += dx * rMinus[i]
      dotPlus += dx * rPlus[i]
    }
    return (dotMinus >= 0 && dotPlus >= 0) ? 1 : 0
  }
}
