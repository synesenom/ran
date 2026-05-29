import GeneralizedPareto from './generalized-pareto'
import Distribution from './_distribution'

/**
 * Probability density function for the [q-exponential distribution]{@link https://en.wikipedia.org/wiki/Q-exponential_distribution}:
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

  static _fitInit (data) {
    // MOM: r=Var/E²=(2−q)/(4−3q) inverts to q=(2−4r)/(1−3r) for r>1/3 (where variance exists)
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || mean * mean
    const r = variance / (mean * mean)
    const q = r > 1 / 3 ? Math.max((2 - 4 * r) / (1 - 3 * r), -5) : 0
    const lambda = Math.max(1 / (mean * (3 - 2 * q)), 1e-3)
    return [q, lambda]
  }
}
