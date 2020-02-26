import MCMC from './mcmc'
import { Normal } from '../dist'

/**
 * Class implementing the (random walk) [Metropolis]{@link https://e.wikipedia.org/wiki/Metropolis%E2%80%93Hastings_algorithm}
 * algorithm.
 * Proposals are updated according to the [Metropolis-Within-Gibbs procedure]{@link http://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.161.2424}:
 *
 * @class RWM
 * @memberOf ran.mc
 * @param {Function} logDensity The logarithm of the density function to estimate.
 * @param {Object=} config RWM configurations.
 * @param {Object=} initialState Initial state of the RWM sampler.
 * @constructor
 */
export default class extends MCMC {
  constructor (logDensity, config, initialState) {
    super(logDensity, config, initialState)

    // Last density value
    this.lastLnp = this.lnp(this.x)

    /**
     * Proposal distributions.
     *
     * @namespace proposal
     * @memberOf ran.mc.RWM
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
         * Samples new state.
         *
         * @method jump
         * @memberOf ran.mc.RWM.proposal
         * @param {Array} x Current state.
         * @param {boolean} single Whether only a single dimension should be updated.
         * @return {Array} New state.
         */
        jump (x, single) {
          return single
            ? x.map((d, i) => d + (i === _index ? _q.sample() * _sigma[_index] : 0))
            : x.map((d, i) => d + _q.sample() * _sigma[i])
        },

        /**
         * Updates proposal distributions.
         *
         * @method update
         * @memberOf ran.mc.RWM.proposal
         * @param {boolean} accepted Whether last state was accepted.
         */
        update (accepted) {
          // Update acceptance for current dimension
          accepted && _acceptance[_index]++
          _n++

          // If batch is finished, update proposal
          if (_n === 100) {
            // Update proposal
            if (_acceptance[_index] / 100 > 0.44) {
              _ls[_index] += Math.min(0.01, Math.pow(_batch, -0.5))
            } else {
              _ls[_index] -= Math.min(0.01, Math.pow(_batch, -0.5))
            }
            _sigma[_index] = Math.exp(_ls[_index])

            // Reset counters and accumulators
            _n = 0
            _acceptance[_index] = 0
            _index = (_index + 1) % self.dim
            if (_index === 0) {
              _batch++
            }
          }
        },

        /**
         * Returns the current scales of the proposals.
         *
         * @method scales
         * @memberOf ran.mc.RWM.proposal
         * @return {Array} Array of proposal scales.
         */
        scales () {
          return _sigma.slice()
        }
      }
    })(this)
  }

  // Internal variables
  _internal () {
    return {
      proposal: this.proposal.scales()
    }
  }

  // Iterator
  _iter (warmUp) {
    let x1 = this.proposal.jump(this.x, warmUp)

    const newLnp = this.lnp(x1)

    const accepted = Math.random() < Math.exp(newLnp - this.lastLnp)
    if (accepted) {
      this.lastLnp = newLnp
    } else {
      x1 = this.x
    }

    return {
      x: x1,
      accepted: accepted
    }
  }

  // Adjustment
  _adjust (i) {
    this.proposal.update(i.accepted)
  }
}
