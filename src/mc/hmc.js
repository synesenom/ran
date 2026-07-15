import MCMC from './_mcmc'
import { Normal } from '../dist'

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
 * `stepSize` (ε, the leapfrog step size, default 0.1) and `pathLength` (L, the number of leapfrog
 * steps per iteration, default 10).
 * @param {Object=} initialState Initial state of the sampler (see MCMC base class).
 * @constructor
 * @throws {Error} If gradLogDensity is not a function, or a stepSize (config.stepSize or a
 * resumed initialState.internal.stepSize) is provided but is not a positive finite number, or a
 * pathLength (config.pathLength or a resumed initialState.internal.pathLength) is provided but
 * is not a positive integer.
 */
// decisions/0020-mcmc-design.md — gradLogDensity is an HMC-specific constructor argument, not
// threaded through the shared MCMC base constructor
// decisions/0025-hmc-iter-alpha-field.md — _iter returns an additional alpha field so _adjust can
// drive dual averaging from the continuous Metropolis acceptance probability
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
    this._q.seed(value)
    // super.seed() may have redrawn this.x from the newly seeded generator, so lastLnp
    // (computed against the pre-seed x at construction time) must be recomputed to match.
    this.lastLnp = this.lnp(this.x)
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
    const r0 = Array.from({ length: this.dim }, () => this._q.sample())
    const { x: xProp, r: rProp } = this._leapfrog(x, r0, eps)

    const logPProp = this.lnp(xProp)
    const kineticCur = 0.5 * r0.reduce((s, ri) => s + ri * ri, 0)
    const kineticProp = 0.5 * rProp.reduce((s, ri) => s + ri * ri, 0)
    const alpha = Math.min(1, Math.exp((logPProp - kineticProp) - (this.lastLnp - kineticCur)))
    const accepted = this.r.next() < alpha
    if (accepted) {
      this.lastLnp = logPProp
    }
    return { x: accepted ? xProp : x, accepted, alpha }
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
    return { stepSize: this._stepSize, pathLength: this._pathLength }
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

  // ─── PRIVATE INSTANCE ───

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
      xCur = xCur.map((xi, i) => xi + eps * rCur[i])
      const grad1 = this._gradLnp(xCur)
      rCur = rCur.map((ri, i) => ri + 0.5 * eps * grad1[i])
    }
    return { x: xCur, r: rCur }
  }
}
