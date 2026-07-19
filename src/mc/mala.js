import MCMC from './_mcmc'
import { Normal } from '../dist'

// Asymptotically optimal MALA acceptance rate under the same weak-convergence-to-diffusion
// framework used for RWM's 0.234 target, but with its own derivation and, unlike RWM, a
// single value independent of dimension (Roberts & Rosenthal 1998, "Optimal Scaling of
// Discrete Approximations to Langevin Diffusions", J. R. Stat. Soc. B 60(1):255-268).
const TARGET = 0.574

// Adaptation batch length, matching RWM's batch cadence (Roberts & Rosenthal 2009,
// "Examples of Adaptive MCMC") — the schedule adapts any single scalar toward a target
// acceptance rate and does not depend on the proposal's drift structure.
const BATCH = 100

/**
 * Class implementing the [Metropolis-adjusted Langevin algorithm]{@link https://en.wikipedia.org/wiki/Metropolis-adjusted_Langevin_algorithm}
 * (MALA) sampler. Proposes a single gradient-informed Langevin step per iteration
 * (`x' = x + (stepSize^2 / 2) * gradLogDensity(x) + stepSize * z`, `z ~ N(0, I)`), then
 * applies a Metropolis-Hastings correction for the proposal's asymmetry (the transition
 * density's mean is state-dependent, so `q(x'|x) != q(x|x')`) to make the chain exact.
 * During warm-up, the step size is adapted via batch Robbins-Monro (Roberts & Rosenthal
 * 2009), the same scheme `RWM` uses, toward the MALA-optimal acceptance rate of ~0.574
 * (Roberts & Rosenthal 1998).
 *
 * @class MALA
 * @memberof ran.mc
 * @param {Object} options MALA options, as a single object.
 * @param {Function} options.logDensity The logarithm of the (unnormalized) target density.
 * @param {Function} options.gradLogDensity The gradient of logDensity: maps a state (number[]) to
 * its gradient (number[]) of the same dimension.
 * @param {Object=} options.config MALA configuration (see MCMC base class for shared options),
 * plus `stepSize` (ε, default 0.1).
 * @param {Object=} options.initialState Initial state of the sampler (see MCMC base class).
 * @constructor
 * @throws {Error} If options is not a plain object, or gradLogDensity is not a function, or a
 * stepSize (config.stepSize or a resumed initialState.internal.stepSize) is provided but is not a
 * positive finite number.
 */
// decisions/0032-mala-options-object-only-constructor.md — options-object-only constructor;
// gradLogDensity is destructured locally and never forwarded to the MCMC base class, whose own
// constructor takes (logDensity, config, initialState) positionally as an internal contract only.
export default class MALA extends MCMC {
  /**
   * @param {Object} options MALA options, as a single object.
   * @param {Function} options.logDensity The logarithm of the (unnormalized) target density.
   * @param {Function} options.gradLogDensity The gradient of logDensity: maps a state (number[])
   * to its gradient (number[]) of the same dimension.
   * @param {Object=} options.config MALA configuration (see MCMC base class for shared options),
   * plus `stepSize` (ε, default 0.1).
   * @param {Object=} options.initialState Initial state of the sampler (see MCMC base class).
   */
  constructor (options) {
    MALA._validateOptions(options)
    const { logDensity, gradLogDensity, config = {}, initialState = {} } = options

    super(logDensity, config, initialState)

    MALA._validateGradLogDensity(gradLogDensity)
    MALA._validateStepSize(config.stepSize)
    // A resumed sampler's initialState.internal is caller-supplied the same way config is,
    // so a corrupted/adversarial internal.stepSize (e.g. Infinity) must be rejected the same
    // way — see solutions/correctness/2026-07-15-1230-hmc-resumed-internal-state-validation-gap.md
    MALA._validateStepSize(this.internal.stepSize)
    // Same rigor as stepSize above: a malformed resumed accumulator field must fail loudly
    // rather than silently corrupt the Robbins-Monro recursion — decisions/0034-mcmc-exact-stream-reproducible-resume.md.
    MCMC._validateFiniteScalar(this.internal.ls, 'MALA: resumed ls')
    MCMC._validateNonNegativeInteger(this.internal.pAccepted, 'MALA: resumed pAccepted')
    MCMC._validateNonNegativeInteger(this.internal.pN, 'MALA: resumed pN')
    MCMC._validateNonNegativeInteger(this.internal.pBatch, 'MALA: resumed pBatch')

    this._gradLnp = gradLogDensity
    // Log-scale storage: the Robbins-Monro update below is additive in log space, so this
    // keeps stepSize positivity a structural invariant instead of a runtime hope. `ls` (raw) is
    // preferred over re-deriving it from `stepSize` via Math.log(Math.exp(...)), which is not
    // guaranteed bit-identical for every float — decisions/0034-mcmc-exact-stream-reproducible-resume.md.
    this._ls = this.internal.ls !== undefined ? this.internal.ls : Math.log(this.internal.stepSize || config.stepSize || 0.1)
    this._q = new Normal(0, 1)
    MCMC._restoreQPrng(this._q, this.internal.prngQ, 'MALA')
    this.lastLnp = this.lnp(this.x)

    this._pAccepted = this.internal.pAccepted || 0
    this._pN = this.internal.pN || 0
    this._pBatch = this.internal.pBatch || 0
  }

  /**
   * Sets the seed for the sampler's pseudo random number generator, including the internal
   * proposal noise distribution's generator.
   *
   * @method seed
   * @memberof ran.mc.MALA
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

  _iter (x) {
    const eps = Math.exp(this._ls)
    const eps2 = eps * eps

    const gradX = this._gradLnp(x)
    const meanFwd = x.map((xi, i) => xi + 0.5 * eps2 * gradX[i])
    const xProp = meanFwd.map((m, i) => m + eps * this._q.sample())

    const logPProp = this.lnp(xProp)
    const gradXProp = this._gradLnp(xProp)
    const meanRev = xProp.map((xi, i) => xi + 0.5 * eps2 * gradXProp[i])

    // Hastings correction for the asymmetric Langevin proposal: log q(x|x') - log q(x'|x),
    // where q is Normal(mean, eps^2 I) centered at the respective forward/reverse drift.
    const logQFwd = -MALA._sqDist(xProp, meanFwd) / (2 * eps2)
    const logQRev = -MALA._sqDist(x, meanRev) / (2 * eps2)

    const logRatio = (logPProp - this.lastLnp) + (logQRev - logQFwd)
    const accepted = this.r.next() < Math.min(1, Math.exp(logRatio))
    if (accepted) {
      this.lastLnp = logPProp
    }
    return { x: accepted ? xProp : x, accepted }
  }

  _adjust (i) {
    if (i.accepted) this._pAccepted++
    this._pN++
    if (this._pN < BATCH) return
    this._pBatch++
    const rate = this._pAccepted / BATCH
    const delta = Math.min(0.01, Math.pow(this._pBatch, -0.5))
    this._ls += rate > TARGET ? delta : -delta
    this._pAccepted = 0
    this._pN = 0
  }

  _internal () {
    return {
      stepSize: Math.exp(this._ls),
      ls: this._ls,
      prngQ: this._q.r.save(),
      pAccepted: this._pAccepted,
      pN: this._pN,
      pBatch: this._pBatch
    }
  }

  // ─── PROTECTED STATIC ───

  // Kept out of the constructor to avoid a Complex Conditional / Complex Method smell there.
  // Destructuring options directly in the constructor's parameter list would throw a generic,
  // engine-dependent TypeError for null (default parameters only cover undefined) or the old
  // positional shape, instead of this clear, MALA-specific message.
  // See solutions/correctness/2026-07-18-1147-mala-null-guard-destructured-parameter-gap.md
  static _validateOptions (options) {
    if (!MALA._isPlainObject(options)) {
      throw Error('MALA: constructor requires an options object: new MALA({ logDensity, gradLogDensity, config, initialState })')
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
      throw Error('MALA: gradLogDensity must be a function')
    }
  }

  // Kept out of the constructor to avoid a Complex Conditional / Complex Method smell there.
  static _validateStepSize (stepSize) {
    if (stepSize === undefined) {
      return
    }
    if (!(Number.isFinite(stepSize) && stepSize > 0)) {
      throw Error('MALA: stepSize must be a positive number')
    }
  }

  // ─── PRIVATE STATIC ───

  static _sqDist (a, b) {
    return a.reduce((s, ai, i) => s + (ai - b[i]) * (ai - b[i]), 0)
  }
}
