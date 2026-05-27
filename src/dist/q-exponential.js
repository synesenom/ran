import GeneralizedPareto from './generalized-pareto'
import Distribution from './_distribution'

/**
 * Probability function for the [q-exponential distribution]{@link https://en.wikipedia.org/wiki/Q-exponential_distribution}:
 *
 * $f(x; q, \lambda) = (2 - q) \lambda e^{-\lambda x}_q,$
 *
 * where $q < 2$, $\lambda > 0$ and $e^x_q$ denotes the [q-exponential function]{@link https://en.wikipedia.org/wiki/Tsallis_statistics#q-exponential}. Support: $x > 0$ if $q \ge 1$, otherwise $x \in \big[0, \frac{1}{\lambda (1 - q)}\big)$.
 *
 * @class QExponential
 * @memberof ran.dist
 * @constructor
 */
export default class QExponential extends GeneralizedPareto {
  /**
   * @param {number} q Shape parameter.
   * @param {number} lambda Rate parameter.
   */
  constructor (q, lambda) {
    super(0, 1 / (lambda * (2 - q)), (q - 1) / (2 - q))

    // Validate parameters
    Distribution.validate({ q, lambda }, [
      'q < 2',
      'lambda > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: q < 1 ? 1 / (lambda * (1 - q)) : Infinity,
      closed: false
    }]
  }
}
