import Distribution from './_distribution'
import { lambertW0 } from '../special'

/**
 * Probability density function for the [generalized exponential distribution]{@link https://docs.scipy.org/doc/scipy/tutorial/stats/continuous_genexpon.html}:
 *
 * $f(x; a, b, c) = \big(a + b (1 - e^{-c x})\big) e^{-(a + b)x + \frac{b}{c} (1 - e^{-c x})},$
 *
 * where $a, b, c > 0$. Support> $x \ge 0$.
 *
 * @class GeneralizedExponential
 * @memberof ran.dist
 * @constructor
 */
export default class GeneralizedExponential extends Distribution {
  /**
   * @param {number} a First shape parameter.
   * @param {number} b Second shape parameter.
   * @param {number} c Third shape parameter.
   */
  constructor (a, b, c) {
    super('continuous', 3)

    // Validate parameters
    this.p = { a, b, c }
    Distribution.validate({ a, b, c }, [
      'a > 0',
      'b > 0',
      'c > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]
  }

  static _fitInit (data) {
    // No closed-form MOM; conservative small shape defaults scaled by 1/mean (initial hazard a+b sets the scale; mean floored for degenerate all-zero data)
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const r = 1 / Math.max(mean, 1e-3)
    return [0.5 * r, 0.5 * r, r]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const z = this.p.b * (1 - Math.exp(-this.p.c * x))
    return (this.p.a + z) * Math.exp(-(this.p.a + this.p.b) * x + z / this.p.c)
  }

  _cdf (x) {
    // expm1(-cx) for exp(-cx)-1; outer -expm1 avoids cancellation in 1-exp(-) near x=0
    return -Math.expm1(-(this.p.a + this.p.b) * x - this.p.b * Math.expm1(-this.p.c * x) / this.p.c)
  }

  _q (p) {
    const ab = this.p.a + this.p.b
    const w = lambertW0(-this.p.b * Math.exp((this.p.c * Math.log(1 - p) - this.p.b) / ab) / ab)
    return (this.p.b * w + this.p.a * w + this.p.b - this.p.c * Math.log(1 - p)) / (this.p.c * ab)
  }
}
