import { gammaLn, gammaLowerIncomplete } from '../special'
import { gamma } from './_standard'
import Distribution from './_distribution'

/**
 * Generator for the [inverse gamma distribution]{@link https://en.wikipedia.org/wiki/Inverse-gamma_distribution}:
 *
 * $$f(x; \alpha, \beta) = \frac{\beta^\alpha}{\Gamma(\alpha)} x^{-\alpha - 1} e^{-\beta/x},$$
 *
 * where \(\alpha, \beta \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
 *
 * @class InverseGamma
 * @memberOf ran.dist
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @param {number=} beta Scale parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (alpha = 1, beta = 1) {
    super('continuous', arguments.length)
    this.p = { alpha, beta }
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: null,
      closed: false
    }]
    this.c = [Math.pow(beta, alpha)]
  }

  _generator () {
    // Direct sampling from gamma
    return 1 / gamma(this.p.alpha, this.p.beta)
  }

  _pdf (x) {
    return this.c[0] * Math.pow(x, -1 - this.p.alpha) * Math.exp(-this.p.beta / x - gammaLn(this.p.alpha))
  }

  _cdf (x) {
    return 1 - gammaLowerIncomplete(this.p.alpha, this.p.beta / x)
  }
}
