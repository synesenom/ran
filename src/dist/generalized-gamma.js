import Gamma from './gamma'
import Distribution from './_distribution'

/**
 * Generator for the [generalized gamma distribution]{@link https://en.wikipedia.org/wiki/Generalized_gamma_distribution}:
 *
 * $f(x; a, d, p) = \frac{p/a^d}{\Gamma(d/p)} x^{d - 1} e^{-(x/a)^p},$
 *
 * where $a, d, p > 0$. Support: $x > 0$.
 *
 * @class GeneralizedGamma
 * @memberof ran.dist
 * @constructor
 */
export default class GeneralizedGamma extends Gamma {
  // Transformation of gamma distribution
  /**
   * @param {number} a Scale parameter.
   * @param {number} d Shape parameter.
   * @param {number} p Shape parameter.
   */
  constructor (a, d, p) {
    super(d / p, Math.pow(a, -p))
    this._q = undefined // Gamma._q is wrong for the power transform; fall back to _qEstimateRoot

    // Validate parameters
    this.p = Object.assign(this.p, { a, d, p })
    Distribution.validate({ a, d, p }, [
      'a > 0',
      'd > 0',
      'p > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: d >= 1 && p >= 1 && d >= p
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling by transforming gamma variate
    return Math.pow(super._generator(), 1 / this.p.p)
  }

  _pdf (x) {
    return this.p.p * Math.pow(x, this.p.p - 1) * super._pdf(Math.pow(x, this.p.p))
  }

  _cdf (x) {
    return super._cdf(Math.pow(x, this.p.p))
  }
}
