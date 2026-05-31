import MCMC from './mcmc'
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

    /**
     * Proposal distributions with per-dimension batch step-size adaptation.
     *
     * @namespace proposal
     * @memberof ran.mc.RWM
     * @private
     */
    this.proposal = (function (self) {
      const _q = new Normal(0, 1)
      const _acceptance = new Array(self.dim).fill(0)
      const _sigma = self.internal.proposal || new Array(self.dim).fill(1)
      const _ls = _sigma.map(d => Math.log(d))
      let _n = 0
      let _batch = 0
      let _index = 0

      return {
        /**
         * Proposes a new state. During warm-up uses single-dimension (Gibbs) updates;
         * during sampling updates all dimensions jointly.
         *
         * @method jump
         * @memberof ran.mc.RWM.proposal
         * @param {number[]} x Current state.
         * @param {boolean} warmUp Whether the jump is part of warm-up.
         * @return {number[]} Proposed state.
         */
        jump (x, warmUp) {
          return warmUp
            ? x.map((d, i) => d + (i === _index ? _q.sample() * _sigma[_index] : 0))
            : x.map((d, i) => d + _q.sample() * _sigma[i])
        },

        /**
         * Updates proposal step sizes using batch Robbins-Monro adaptation targeting
         * 0.44 per-component acceptance rate.
         *
         * @method update
         * @memberof ran.mc.RWM.proposal
         * @param {boolean} accepted Whether the last proposal was accepted.
         */
        update (accepted) {
          accepted && _acceptance[_index]++
          _n++
          if (_n === 100) {
            if (_acceptance[_index] / 100 > 0.44) {
              _ls[_index] += Math.min(0.01, Math.pow(_batch, -0.5))
            } else {
              _ls[_index] -= Math.min(0.01, Math.pow(_batch, -0.5))
            }
            _sigma[_index] = Math.exp(_ls[_index])
            _n = 0
            _acceptance[_index] = 0
            _index = (_index + 1) % self.dim
            if (_index === 0) {
              _batch++
            }
          }
        },

        /**
         * Returns the current proposal scales.
         *
         * @method scales
         * @memberof ran.mc.RWM.proposal
         * @return {number[]} Copy of the per-dimension step sizes.
         */
        scales () {
          return _sigma.slice()
        }
      }
    })(this)
  }

  _internal () {
    return {
      proposal: this.proposal.scales()
    }
  }

  _iter (x, warmUp) {
    let x1 = this.proposal.jump(x, warmUp)
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
    this.proposal.update(i.accepted)
  }
}
