import { gamma } from './_standard'
import Distribution from './_distribution'

/**
 * Generator for [Wigner distribution]{@link https://en.wikipedia.org/wiki/Wigner_semicircle_distribution} (also known
 * as semicircle distribution):
 *
 * $$f(x; R) = \frac{2}{\pi R^2} \sqrt{R^2 - x^2},$$
 *
 * with \(R \in \mathbb{R}^+\). Support: \(x \in [-R, R]\).
 *
 * @class Wigner
 * @memberOf ran.dist
 * @param {number=} R Radius of the distribution. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (R = 1) {
    super('continuous', arguments.length)
    this.p = { R }
    this.s = [{
      value: -R,
      closed: true
    }, {
      value: R,
      closed: true
    }]
  }

  _generator () {
    // Direct sampling by transforming beta variate
    let x = gamma(1.5, 1)
    let y = gamma(1.5, 1)
    return 2 * this.p.R * x / (x + y) - this.p.R
  }

  _pdf (x) {
    let r = this.p.R * this.p.R
    return 2 * Math.sqrt(r - x * x) / (Math.PI * r)
  }

  _cdf (x) {
    let r = this.p.R * this.p.R
    return 0.5 + x * Math.sqrt(r - x * x) / (Math.PI * r) + Math.asin(x / this.p.R) / Math.PI
  }
}
