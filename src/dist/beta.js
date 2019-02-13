import { gamma } from './_standard'
import Distribution from './_distribution'
import { beta as fnBeta, regularizedBetaIncomplete } from '../special'

/**
 * Generator for the [beta distribution]{@link https://en.wikipedia.org/wiki/Beta_distribution}:
 *
 * $$f(x; \alpha, \beta) = \frac{x^{\alpha - 1}(1 - x)^{\beta - 1}}{\mathrm{B}(\alpha, \beta)},$$
 *
 * with \(\alpha, \beta \in \mathbb{R}^+\) and \(\mathrm{B}(\alpha, \beta)\) is the beta function.
 * Support: \(x \in [0, 1]\).
 *
 * @class Beta
 * @memberOf ran.dist
 * @param {number=} alpha First shape parameter. Default value is 1.
 * @param {number=} beta Second shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (alpha = 1, beta = 1) {
    super('continuous', arguments.length)
    this.p = { alpha, beta }
    this.s = [{
      value: 0,
      closed: alpha >= 1
    }, {
      value: 1,
      closed: beta >= 1
    }]
    this.c = [fnBeta(alpha, beta)]
  }

  _generator () {
    // Direct sampling from gamma
    let x = gamma(this.p.alpha, 1)

    let y = gamma(this.p.beta, 1)
    return x / (x + y)
  }

  _pdf (x) {
    return Math.pow(x, this.p.alpha - 1) * Math.pow(1 - x, this.p.beta - 1) / this.c[0]
  }

  _cdf (x) {
    return regularizedBetaIncomplete(this.p.alpha, this.p.beta, x)
  }
}
