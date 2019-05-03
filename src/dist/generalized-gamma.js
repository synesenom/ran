import Gamma from './gamma'

/**
 * Generator for the [generalized gamma distribution]{@link https://en.wikipedia.org/wiki/Generalized_gamma_distribution}:
 *
 * $$f(x; a, d, p) = \frac{p/a^d}{\Gamma(d/p)} x^{d - 1} e^{-(x/a)^p},$$
 *
 * where \(a, d, p > 0\). Support: \(x > 0\).
 *
 * @class GeneralizedGamma
 * @memberOf ran.dist
 * @param {number=} a Scale parameter. Default value is 1.
 * @param {number=} d Shape parameter. Default value is 1.
 * @param {number=} p Shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Gamma {
  // Transformation of gamma distribution
  constructor (a = 1, d = 1, p = 1) {
    super(d / p, Math.pow(a, -p))

    // Validate parameters
    this.p = Object.assign(this.p, { a, d, p })
    Distribution._validate({ a, d, p }, [
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
