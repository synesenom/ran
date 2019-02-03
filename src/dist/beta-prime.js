import Beta from './beta'

/**
 * Generator for the [beta prime distribution]{@link https://en.wikipedia.org/wiki/Beta_prime_distribution} (also
 * known as inverted beta):
 *
 * $$f(x; \alpha, \beta) = \frac{x^{\alpha - 1}(1 - x)^{-\alpha - \beta}}{\mathrm{B}(\alpha, \beta)},$$
 *
 * with \(\alpha, \beta \in \mathbb{R}^+\) and \(\mathrm{B}(\alpha, \beta)\) is the beta function.
 * Support: \(x \in \mathbb{R}^+\).
 *
 * @class BetaPrime
 * @memberOf ran.dist
 * @param {number=} alpha First shape parameter. Default value is 2.
 * @param {number=} beta Second shape parameter. Default value is 2.
 * @constructor
 */
export default class extends Beta {
  // Transformation of beta distribution
  constructor (alpha = 2, beta = 2) {
    super(alpha, beta)
    this.s = [{
      value: 0,
      closed: alpha >= 1
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling by transforming beta variate
    let x = super._generator()
    return x / (1 - x)
  }

  _pdf (x) {
    return super._pdf(x / (1 + x)) / Math.pow(1 + x, 2)
  }

  _cdf (x) {
    return super._cdf(x / (1 + x))
  }
}
