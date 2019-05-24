import GeneralizedNormal from './generalized-normal'

/**
 * Generator for the [half generalized normal distribution]{@link https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.halfgennorm.html}:
 *
 * $$f(x; \alpha, \beta) = \frac{\beta}{\Gamma\big(\frac{1}{\beta}\big)} e^{-|x|^\beta},$$
 *
 * with \(\alpha, \beta > 0\). Support: \(x > 0\).
 *
 * @class HalfGeneralizedNormal
 * @memberOf ran.dist
 * @param {number=} alpha Scale parameter. Default value is 1.
 * @param {number=} beta Shape parameter. Default value is 1.
 * @constructor
 */
export default class extends GeneralizedNormal {
  constructor (alpha = 1, beta = 1) {
    super(0, alpha, beta)

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling by transforming normal variate
    return Math.abs(super._generator())
  }

  _pdf (x) {
    return 2 * super._pdf(x)
  }

  _cdf (x) {
    return 2 * super._cdf(x) - 1
  }
}
