import Distribution from './_distribution'
import { erf, erfinv } from '../special/error'

/**
 * Generator for the [alpha distribution]{@link https://docs.scipy.org/doc/scipy-1.0.0/reference/tutorial/stats/continuous_alpha.html}:
 *
 * $$f(x; \alpha) = \frac{1}{x^2 \Phi(\alpha) \sqrt{2 \pi}} \exp\bigg[-\frac{1}{2} \bigg(\alpha - \frac{1}{x}\bigg)^2\bigg],$$
 *
 * @class Alpha
 * @memberOf ran.dist
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (alpha = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { alpha }
    Distribution._validate({ alpha }, [
      'alpha > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    this.c = [
      this._phi(alpha),
      this._phi(alpha) * Math.sqrt(2 * Math.PI)
    ]
  }

  _phi (x) {
    return 0.5 * (1 + erf(x / Math.SQRT2))
  }

  _phiInv (x) {
    return Math.SQRT2 * erfinv(2 * x - 1)
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return Math.exp(-0.5 * Math.pow(this.p.alpha - 1 / x, 2)) / (x * x * this.c[1])
  }

  _cdf (x) {
    return this._phi(this.p.alpha - 1 / x) / this.c[0]
  }

  _q (p) {
    return 1 / (this.p.alpha - this._phiInv(p * this.c[0]))
  }
}
