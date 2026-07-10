import MCMC from './_mcmc'
import { float } from '../core'
import { Normal } from '../dist'

/**
 * Class implementing the (random walk) [Metropolis]{@link https://en.wikipedia.org/wiki/Metropolis%E2%80%93Hastings_algorithm}
 * algorithm. Proposals are updated per dimension using the
 * [Metropolis-within-Gibbs]{@link http://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.161.2424}
 * procedure during warm-up and joint proposals during sampling.
 *
 * @class RWM
 * @memberof ran.mc
 * @param {Function} logDensity The logarithm of the (unnormalized) target density.
 * @param {Object=} config RWM configuration (see MCMC base class for shared options).
 * @param {Object=} initialState Initial state of the sampler (see MCMC base class).
 * @constructor
 */
export default class RWM extends MCMC {
  constructor (logDensity, config, initialState) {
    super(logDensity, config, initialState)
    this.lastLnp = this.lnp(this.x)
    this._q = new Normal(0, 1)
    this._sigma = (this.internal.proposal || new Array(this.dim).fill(1)).slice()
    this._ls = this._sigma.map(d => Math.log(d))
    this._pAccepted = new Array(this.dim).fill(0)
    this._pN = 0
    this._pBatch = 0
    this._pIndex = 0
  }

  // Proposes a new state. During warm-up: single-dimension (Gibbs) update.
  // During sampling: all dimensions updated jointly.
  _jump (x, warmUp) {
    return warmUp
      ? x.map((d, i) => d + (i === this._pIndex ? this._q.sample() * this._sigma[this._pIndex] : 0))
      : x.map((d, i) => d + this._q.sample() * this._sigma[i])
  }

  // Batch Robbins-Monro step-size adaptation targeting 0.44 per-component acceptance rate.
  _updateProposal (accepted) {
    if (accepted) this._pAccepted[this._pIndex]++
    this._pN++
    if (this._pN === 100) {
      const delta = Math.min(0.01, Math.pow(this._pBatch, -0.5))
      this._ls[this._pIndex] += this._pAccepted[this._pIndex] / 100 > 0.44 ? delta : -delta
      this._sigma[this._pIndex] = Math.exp(this._ls[this._pIndex])
      this._pAccepted[this._pIndex] = 0
      this._pN = 0
      this._pIndex = (this._pIndex + 1) % this.dim
      if (this._pIndex === 0) this._pBatch++
    }
  }

  _internal () {
    return { proposal: this._sigma.slice() }
  }

  _iter (x, warmUp) {
    let x1 = this._jump(x, warmUp)
    const newLnp = this.lnp(x1)
    const accepted = float() < Math.exp(newLnp - this.lastLnp)
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
}
