import { besselI } from '../special/bessel'
import marcumQ from '../special/marcum-q'
import { gamma, poisson } from './_core'
import Distribution from './_distribution'

/**
 * Generator for the [Rice distribution]{@link https://en.wikipedia.org/wiki/Rice_distribution}:
 *
 * $$f(x; \nu, \sigma) = \frac{x}{\sigma^2} e^{-\frac{x^2 + \nu^2}{2 \sigma^2}} I_0\bigg(\frac{\nu x}{\sigma^2}\bigg),$$
 *
 * with \(\nu, \sigma \in \mathbb{R}^+\) and \(I_0(x)\) is the modified Bessel function of the first kind with order zero. Support: \(x \in [0, \infty)\).
 *
 * @class Rice
 * @memberOf ran.dist
 * @param {number=} nu First shape parameter. Default value is 1.
 * @param {number=} sigma Second shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (nu = 1, sigma = 1) {
    super('continuous', arguments.length)
    this.p = { nu, sigma }
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]
    this.c = [
      0.5 * Math.pow(nu / sigma, 2),
      sigma * sigma,
      nu / (sigma * sigma),
      nu * nu
    ]
  }

  _generator () {
    // Direct sampling using Poisson and gamma
    let p = poisson(this.r, this.c[0])
    let x = gamma(this.r, p + 1, 0.5)
    return this.p.sigma * Math.sqrt(x)
  }

  _pdf (x) {
    let z = x * this.p.nu / this.c[1]
    let b = besselI(0, z)

    // Handle z >> 1 case (using asymptotic form of Bessel)
    if (isFinite(b)) {
      return x * Math.exp(-0.5 * (x * x + this.c[3]) / this.c[1]) * besselI(0, x * this.c[2]) / this.c[1]
    } else {
      return x * Math.exp(-0.5 * (x * x + this.c[3]) / this.c[1] + z - 0.5 * Math.log(2 * Math.PI * z)) / this.c[1]
    }
  }

  _cdf (x) {
    return 1 - marcumQ(1, this.c[0], Math.pow(x / this.p.sigma, 2) / 2)
  }
}
