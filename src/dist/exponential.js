import { exponential } from './_core'
import Distribution from './_distribution'

/**
 * Generator for the [exponential distribution]{@link https://en.wikipedia.org/wiki/Exponential_distribution}:
 *
 * $$f(x; \lambda) = \lambda e^{-\lambda x},$$
 *
 * with \(\lambda \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+ \cup \{0\}\).
 *
 * @class Exponential
 * @memberOf ran.dist
 * @param {number=} lambda Rate parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (lambda = 1) {
    super('continuous', arguments.length)
    this.p = { lambda }
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    // return -Math.log(Math.random()) / this.p.lambda
    return exponential(this.r, this.p.lambda)
  }

  _pdf (x) {
    return this.p.lambda * Math.exp(-this.p.lambda * x)
  }

  _cdf (x) {
    return 1 - Math.exp(-this.p.lambda * x)
  }
}
