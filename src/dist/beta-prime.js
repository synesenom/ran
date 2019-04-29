import { gamma } from './_core'
import Beta from './beta'

/**
 * Generator for the [beta prime distribution]{@link https://en.wikipedia.org/wiki/Beta_prime_distribution} (also
 * known as inverted beta):
 *
 * $$f(x; \alpha, \beta) = \frac{x^{\alpha - 1}(1 + x)^{-\alpha - \beta}}{\mathrm{B}(\alpha, \beta)},$$
 *
 * with \(\alpha, \beta > 0\) and \(\mathrm{B}(\alpha, \beta)\) is the beta function.
 * Support: \(x > 0\).
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

    // Set support
    this.s = [{
      value: 0,
      closed: alpha >= 1
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling from gamma (ignoring super)
    let x = gamma(this.r, this.p.alpha, 1)

    let y = gamma(this.r, this.p.beta, 1)
    return x / y
  }

  _pdf (x) {
    return super._pdf(x / (1 + x)) / Math.pow(1 + x, 2)
  }

  _cdf (x) {
    return super._cdf(x / (1 + x))
  }
}
