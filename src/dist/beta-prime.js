import { beta as fnBeta, betaIncomplete } from '../special'
import { gamma } from './_standard'
import Distribution from './_distribution'

/**
 * Generator for the [beta prime distribution]{@link https://en.wikipedia.org/wiki/Beta_prime_distribution} (also
 * known as inverted beta):
 *
 * $$f(x; \alpha, \beta) = \frac{x^{\alpha - 1}(1 - x)^{-\alpha - \beta}}{\mathrm{B}(\alpha, \beta)},$$
 *
 * with \(\alpha, \beta \in \mathbb{R}^+\) and \(\mathrm{B}(\alpha, \beta)\) is the beta function.
 * Support: \(x \in \mathbb{R}^+\).
 *
 *
 * @class BetaPrime
 * @memberOf ran.dist
 * @param {number=} alpha First shape parameter. Default value is 2.
 * @param {number=} beta Second shape parameter. Default value is 2.
 * @constructor
 */
export default class extends Distribution {
  constructor (alpha = 2, beta = 2) {
    super('continuous', arguments.length)
    this.p = { alpha, beta }
    this.s = [{
      value: 0,
      closed: alpha >= 1
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling from gamma
    return gamma(this.p.alpha, 1) / gamma(this.p.beta, 1)
  }

  _pdf (x) {
    return Math.pow(x, this.p.alpha - 1) * Math.pow(1 + x, -this.p.alpha - this.p.beta) / fnBeta(this.p.alpha, this.p.beta)
  }

  _cdf (x) {
    return betaIncomplete(this.p.alpha, this.p.beta, x / (1 + x))
  }
}
