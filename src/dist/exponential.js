import exponential from './_exponential'
import Distribution from './_distribution'

/**
 * Probability density function for the [exponential distribution]{@link https://en.wikipedia.org/wiki/Exponential_distribution}:
 *
 * $f(x; \lambda) = \lambda e^{-\lambda x},$
 *
 * with $\lambda > 0$. Support: $x \ge 0$.
 *
 * @class Exponential
 * @memberof ran.dist
 * @constructor
 */
export default class Exponential extends Distribution {
  /**
   * @param {number} lambda Rate parameter.
   */
  constructor (lambda) {
    super('continuous', 1)

    // Validate parameters
    this.p = { lambda }
    Distribution.validate({ lambda }, [
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
    this.c = {
      expNegLambda: Math.exp(-lambda)
    }
  }

  _generator () {
    // Inverse transform sampling
    return exponential(this.r, this.p.lambda)
  }

  _pdf (x) {
    return this.p.lambda * Math.pow(this.c.expNegLambda, x)
  }

  _cdf (x) {
    // -expm1(-lambda*x) avoids catastrophic cancellation when lambda*x is near 0
    return -Math.expm1(-this.p.lambda * x)
  }

  _q (p) {
    return -Math.log(1 - p) / this.p.lambda
  }
}
