import { gammaLowerIncomplete, logGamma } from '../special'
import poisson from './_poisson'
import Distribution from './_distribution'

/**
 * Probability mass function for the [Poisson distribution]{@link https://en.wikipedia.org/wiki/Poisson_distribution}:
 *
 * $f(k; \lambda) = \frac{\lambda^k e^{-\lambda}}{k!},$
 *
 * with $\lambda > 0$. Support: $k \in \mathbb{N}_0$.
 *
 * @class Poisson
 * @memberof ran.dist
 * @constructor
 */
export default class Poisson extends Distribution {
  /**
   * @param {number} lambda Mean of the distribution.
   */
  constructor (lambda) {
    super('discrete', 1)

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
      logLambda: Math.log(lambda)
    }
  }

  static get _fitInitIsExact () {
    // _fitInit returns the exact closed-form MLE, so fit() skips the optimizer (ADR-0016).
    return true
  }

  static _fitInit (data) {
    // MLE for lambda is the sample mean since E[X] = lambda.
    const mean = data.reduce((s, x) => s + x, 0) / data.length
    return [mean]
  }

  _generator () {
    return poisson(this.r, this.p.lambda)
  }

  _pdf (x) {
    return Math.exp(x * this.c.logLambda - this.p.lambda - logGamma(x + 1))
  }

  _cdf (x) {
    return 1 - gammaLowerIncomplete(x + 1, this.p.lambda)
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return this.p.lambda
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    return this.p.lambda
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    return 1 / Math.sqrt(this.p.lambda)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    return 1 / this.p.lambda
  }
}
