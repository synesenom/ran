import exponential from './_exponential'
import Distribution from './_distribution'

/**
 * Probability density function for the [exponential distribution]{@link https://en.wikipedia.org/wiki/Exponential_distribution}:
 *
 * $f(x; \lambda) = \lambda e^{-\lambda x},$
 *
 * with $\lambda > 0$. Support: $x \ge 0$.
 *
 * Cumulative distribution function:
 *
 * $F(x; \lambda) = 1 - e^{-\lambda x}$
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
    /** @type {*} */
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

  /**
   * @returns {number} Reciprocal of the rate.
   */
  mean () {
    return 1 / this.p.lambda
  }

  /**
   * @returns {number} Reciprocal of the squared rate.
   */
  variance () {
    return 1 / (this.p.lambda * this.p.lambda)
  }

  /**
   * @returns {number} 2 (constant for all exponential distributions).
   */
  skewness () {
    return 2
  }

  /**
   * @returns {number} 6 (constant excess kurtosis for all exponential distributions).
   */
  kurtosis () {
    return 6
  }

  static get _fitInitIsExact () {
    // _fitInit returns the exact closed-form MLE, so fit() skips the optimizer (ADR-0016).
    return true
  }

  static _fitInit (data) {
    // MLE: rate = 1/mean
    return [data.length / data.reduce((s, x) => s + x, 0)]
  }
}
