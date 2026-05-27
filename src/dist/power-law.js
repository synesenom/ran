import Kumaraswamy from './kumaraswamy'

/**
 * Probability density function for the [power-law distribution]{@link https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.powerlaw.html} (also called power-law distribution):
 *
 * $f(x; a) = a x^{a - 1},$
 *
 * with $a > 0$. Support: $x \in (0, 1)$. It is a special case of the [Kumaraswamy distribution]{@link #dist.Kumaraswamy}.
 *
 * @class PowerLaw
 * @memberof ran.dist
 * @constructor
 */
export default class PowerLaw extends Kumaraswamy {
  // Special case of Kumaraswamy.
  /**
   * @param {number} a One plus the exponent of the distribution.
   */
  constructor (a) {
    super(a, 1)
  }
}
