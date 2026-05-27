import Distribution from './_distribution'
import Gamma from './gamma'

/**
 * Probability function for the [$\chi^2$ distribution]{@link https://en.wikipedia.org/wiki/Chi-squared_distribution}:
 *
 * $f(x; k) = \frac{1}{2^{k/2} \Gamma(k/2)} x^{k/2 - 1} e^{-x/2},$
 *
 * where $k \in \mathbb{N}^+$. Support: $x > 0$.
 *
 * @class Chi2
 * @memberof ran.dist
 * @constructor
 */
export default class Chi2 extends Gamma {
  // Special case of gamma
  /**
   * @param {number} k Degrees of freedom. If not an integer, is rounded to the nearest one.
   */
  constructor (k) {
    super(Math.round(k) / 2, 0.5)

    // Validate parameters
    Distribution.validate({ k }, [
      'k > 0'
    ])
  }
}
