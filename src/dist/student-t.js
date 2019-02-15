import { beta, regularizedBetaIncomplete } from '../special'
import { sign, gamma } from './_standard'
import Distribution from './_distribution'

/**
 * Generator for [Student's t-distribution]{@link https://en.wikipedia.org/wiki/Student%27s_t-distribution}:
 *
 * $$f(x; \nu) = \frac{1}{\sqrt{\nu}\mathrm{B}\big(\frac{1}{2}, \frac{\nu}{2}\big)} \Big(1 + \frac{x^2}{\nu}\Big)^{-\frac{\nu + 1}{2}},$$
 *
 * with \(\nu \in \mathbb{R}^+\) and \(\mathrm{B}(x, y)\) is the beta function. Support: \(x \in \mathbb{R}\).
 *
 * @class StudentT
 * @memberOf ran.dist
 * @param {number=} nu Degrees of freedom. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (nu = 1) {
    super('continuous', arguments.length)
    this.p = { nu }
    this.s = [{
      value: null,
      closed: false
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling using gamma variates
    return sign() * Math.sqrt(this.p.nu * gamma(0.5) / gamma(this.p.nu / 2))
  }

  _pdf (x) {
    return Math.pow(1 + x * x / this.p.nu, -0.5 * (this.p.nu + 1)) / (Math.sqrt(this.p.nu) * beta(0.5, this.p.nu / 2))
  }

  _cdf (x) {
    return x > 0
      ? 1 - 0.5 * regularizedBetaIncomplete(this.p.nu / 2, 0.5, this.p.nu / (x * x + this.p.nu))
      : 0.5 * regularizedBetaIncomplete(this.p.nu / 2, 0.5, this.p.nu / (x * x + this.p.nu))
  }
}
