import Gamma from './gamma'
import Distribution from './_distribution'

/**
 * Generator for the [Maxwell-Boltzmann distribution]{@link https://en.wikipedia.org/wiki/Maxwell%E2%80%93Boltzmann_distribution}:
 *
 * $f(x; a) = \sqrt{\frac{2}{\pi}}\frac{x^2 e^{-x^2 / (2a^2)}}{a^3},$
 *
 * with $a > 0$. Support: $x > 0$.
 *
 * @class MaxwellBoltzmann
 * @memberof ran.dist
 * @constructor
 */
export default class MaxwellBoltzmann extends Gamma {
  /**
   * @param {number} a Scale parameter.
   */
  constructor (a) {
    // X = sqrt(Y) where Y ~ Gamma(3/2, rate=1/(2a²)); Jacobian gives Maxwell-Boltzmann PDF
    super(1.5, 0.5 / (a * a))
    this._q = undefined // Gamma._q is wrong for the sqrt transform; fall back to _qEstimateRoot

    // Validate parameters
    Distribution.validate({ a }, [
      'a > 0'
    ])
  }

  _generator () {
    return Math.sqrt(super._generator())
  }

  _pdf (x) {
    return 2 * x * super._pdf(x * x)
  }

  _cdf (x) {
    return super._cdf(x * x)
  }
}
