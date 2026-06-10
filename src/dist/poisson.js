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
 * @see D. E. Knuth, "Seminumerical Algorithms", The Art of Computer Programming vol. 2, 1969 (small λ). A. C. Atkinson, "The Computer Generation of Poisson Random Variables", Appl. Stat. 28(1), 29–35, 1979 (large λ).
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
    return Math.exp(x * Math.log(this.p.lambda) - this.p.lambda - logGamma(x + 1))
  }

  _cdf (x) {
    return 1 - gammaLowerIncomplete(x + 1, this.p.lambda)
  }
}
