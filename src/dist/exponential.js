import { exponential } from './_core'
import Distribution from './_distribution'

/**
 * Generator for the [exponential distribution]{@link https://en.wikipedia.org/wiki/Exponential_distribution}:
 *
 * $$f(x; \lambda) = \lambda e^{-\lambda x},$$
 *
 * with \(\lambda > 0\). Support: \(x \ge 0\).
 *
 * @class Exponential
 * @memberOf ran.dist
 * @param {number=} lambda Rate parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (lambda = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { lambda }
    Distribution._validate({ lambda }, [
      'lambda > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    this.c = [
      Math.exp(-lambda)
    ]
  }

  _generator () {
    // Inverse transform sampling
    return exponential(this.r, this.p.lambda)
  }

  _pdf (x) {
    return this.p.lambda * Math.pow(this.c[0], x)
  }

  _cdf (x) {
    return 1 - Math.pow(this.c[0], x)
  }

  _q (p) {
    return -Math.log(1 - p) / this.p.lambda
  }
}
