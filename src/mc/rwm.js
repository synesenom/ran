import MCMC from './_mcmc'
import { Normal } from '../dist'

// Optimal Metropolis acceptance rates for a random-walk proposal: 0.44 in one
// dimension, 0.234 in the high-dimensional limit (Roberts, Gelman & Gilks 1997;
// Roberts & Rosenthal 2001). 0.234 is the standard multivariate target used for
// every d > 1 — the intermediate optima (d=2: ~0.35, d=3: ~0.28) converge to it
// quickly and are not worth a per-dimension table.
const TARGET_1D = 0.44
const TARGET_ND = 0.234

// Adaptation batch length: acceptance is estimated over this many joint proposals
// before the global scale is nudged. Matches the batch cadence of the Robbins-Monro
// schedule in Roberts & Rosenthal (2009), "Examples of Adaptive MCMC".
const BATCH = 100

/**
 * Class implementing the (random walk) [Metropolis]{@link https://en.wikipedia.org/wiki/Metropolis%E2%80%93Hastings_algorithm}
 * algorithm as a diagonal [adaptive Metropolis]{@link https://projecteuclid.org/euclid.bj/1080222083} sampler.
 * Proposals are joint (every component perturbed at once) in both warm-up and sampling; during warm-up a single
 * global step scale is adapted via batch Robbins-Monro toward the optimal acceptance rate (0.44 in one dimension,
 * 0.234 for higher dimensions) and the per-component scales track the running marginal standard deviations.
 *
 * @class RWM
 * @memberof ran.mc
 * @param {Object} options Sampler options, as a single object.
 * @param {Function} options.logDensity The logarithm of the (unnormalized) target density.
 * @param {Object=} options.config RWM configuration (see MCMC base class for shared options).
 * @param {Object=} options.initialState Initial state of the sampler (see MCMC base class).
 * @constructor
 * @throws {Error} If options is not a plain object.
 */
// decisions/0022-rwm-joint-adaptive-metropolis.md — joint diagonal adaptive Metropolis in both phases
// decisions/0030-mcmc-options-object-constructor.md — options-object-only constructor
export default class RWM extends MCMC {
  /**
   * @param {Object} options Sampler options, as a single object.
   * @param {Function} options.logDensity The logarithm of the (unnormalized) target density.
   * @param {Object=} options.config RWM configuration (see MCMC base class for shared options).
   * @param {Object=} options.initialState Initial state of the sampler (see MCMC base class).
   * @throws {Error} If options is not a plain object.
   */
  constructor (options = {}) {
    RWM._validateOptions(options)
    const { logDensity, config, initialState } = options
    super(logDensity, config, initialState)
    this.lastLnp = this.lnp(this.x)
    this._q = new Normal(0, 1)
    // Per-component base proposal scale: seeded from the caller-supplied proposal
    // (or 1) and replaced by the running marginal std once warm-up has data.
    this._base = (this.internal.proposal || new Array(this.dim).fill(1)).slice()
    // Global log step scale, adapted toward the acceptance target during warm-up.
    this._ls = 0
    this._target = this.dim === 1 ? TARGET_1D : TARGET_ND
    this._pAccepted = 0
    this._pN = 0
    this._pBatch = 0
  }

  /**
   * Sets the seed for the sampler's pseudo random number generator, including the internal
   * proposal distribution's generator.
   *
   * @method seed
   * @memberof ran.mc.RWM
   * @param {number|string} value The value of the seed, either a number or a string (for the ease of tracking seeds).
   * @returns {this} Reference to the current sampler.
   * @ignore
   */
  seed (value) {
    super.seed(value)
    this._reseedCachedLogDensity(value)
    return this
  }

  _iter (x) {
    let x1 = this._jump(x)
    const newLnp = this.lnp(x1)
    const accepted = this.r.next() < Math.exp(newLnp - this.lastLnp)
    if (accepted) {
      this.lastLnp = newLnp
    } else {
      x1 = x
    }
    return { x: x1, accepted }
  }

  _adjust (i) {
    this._updateProposal(i.accepted)
  }

  _internal () {
    // Serialize the effective per-component proposal std (global scale folded in)
    // so a resumed sampler reproduces the same joint proposal.
    const s = Math.exp(this._ls)
    return { proposal: this._base.map(d => d * s) }
  }

  // Joint random-walk proposal: every component is perturbed at once, scaled by the
  // global step exp(_ls) times its per-component base scale.
  _jump (x) {
    const s = Math.exp(this._ls)
    return x.map((d, i) => d + this._q.sample() * s * this._base[i])
  }

  // Batch adaptation of the joint proposal (warm-up only): adapt one global log-scale
  // toward the target acceptance rate (Robbins-Monro, delta = min(0.01, batch^-1/2), the
  // Roberts & Rosenthal 2009 schedule), and refresh the per-component base scales from the
  // running marginal standard deviations so heterogeneous marginals stay well scaled.
  // A single joint accept/reject cannot attribute acceptance to individual components, so
  // per-component scaling is learned from the marginal variances rather than the acceptance.
  _updateProposal (accepted) {
    if (accepted) this._pAccepted++
    this._pN++
    if (this._pN < BATCH) return
    this._pBatch++
    const rate = this._pAccepted / BATCH
    const delta = Math.min(0.01, Math.pow(this._pBatch, -0.5))
    this._ls += rate > this._target ? delta : -delta
    this._refreshBase()
    this._pAccepted = 0
    this._pN = 0
  }

  _refreshBase () {
    const stats = this.statistics()
    for (let i = 0; i < this.dim; i++) {
      // Keep the seeded base until a component has a positive spread estimate; a zero-std
      // early batch (n <= 1) would otherwise collapse the proposal to a point mass.
      if (stats[i].std > 0) {
        this._base[i] = stats[i].std
      }
    }
  }

  // Kept out of the constructor to avoid a Complex Conditional / Complex Method smell there.
  // Destructuring options directly in the constructor's parameter list would throw a generic,
  // engine-dependent TypeError for null (default parameters only cover undefined) instead of this
  // clear, RWM-specific message.
  // See decisions/0032-mala-options-object-only-constructor.md and
  // solutions/correctness/2026-07-18-1147-mala-null-guard-destructured-parameter-gap.md
  static _validateOptions (options) {
    if (!RWM._isPlainObject(options)) {
      throw Error('RWM: constructor requires an options object: new RWM({ logDensity, config, initialState })')
    }
  }

  // Split from _validateOptions so the compound check is a single return expression rather than
  // a branch condition, which is what the Complex Conditional smell flags.
  static _isPlainObject (options) {
    return options !== undefined && options !== null && typeof options === 'object' && !Array.isArray(options)
  }
}
