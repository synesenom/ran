import logGamma from '../special/log-gamma'
import { gammaLowerIncomplete } from '../special/gamma-incomplete'
import { gamma } from './_core'
import Distribution from './_distribution'

/**
 * Generator for the [inverse \(\chi^2\) distribution]{@link https://en.wikipedia.org/wiki/Inverse-chi-squared_distribution}:
 *
 * $$f(x; \nu) = \frac{2^{-\nu/2}}{\Gamma(\nu / 2)} x^{-\nu/2 - 1} e^{-1/(2x)},$$
 *
 * with \(\nu \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
 *
 * @class InverseChi2
 * @memberOf ran.dist
 * @param {number=} nu Degrees of freedom. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (nu = 1) {
    super('continuous', arguments.length)
    this.p = { nu: Math.round(nu) }
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
    this.mode = 1 / (nu + 2)
  }

  _generator () {
    // Direct sampling
    return 1 / gamma(this.r, Math.round(this.p.nu) / 2, 0.5)
  }

  _pdf (x) {
    return Math.pow(2, -this.p.nu / 2) * Math.pow(x, -this.p.nu / 2 - 1) * Math.exp(-0.5 / x - logGamma(this.p.nu / 2))
  }

  _cdf (x) {
    return 1 - gammaLowerIncomplete(this.p.nu / 2, 0.5 / x)
  }
}
