import Dagum from './dagum'
import Distribution from './_distribution'

/**
 * Generator for the [Mielke distribution]{@link https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.mielke.html#r7049b665a02e-2}:
 *
 * $f(x; k, s) = \frac{k x^{k - 1}}{(1 + x^s)^{1 + k/s}},$
 *
 * with $k, s > 0$. Support: $x > 0$. It can be viewed as a re-parametrization of the [Dagum distribution]{@link #dist.Dagum}.
 *
 * @class Mielke
 * @memberof ran.dist
 * @constructor
 */
export default class Mielke extends Dagum {
  /**
   * @param {number} k First shape parameter.
   * @param {number} s Second shape parameter.
   */
  constructor (k, s) {
    super(k / s, s, 1)

    // Validate parameters
    Distribution.validate({ k, s }, [
      'k > 0',
      's > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }
}
