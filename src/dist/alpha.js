import Distribution from './_distribution'
import { erf, erfinv } from '../special/error'

/**
 * Generator for the [alpha distribution]{@link https://docs.scipy.org/doc/scipy/reference/tutorial/stats/continuous_alpha.html}:
 *
 * $$f(x; \alpha) = \frac{\phi\Big(\alpha - \frac{\beta}{x}\Big)}{x^2 \Phi(\alpha)},$$
 *
 * where $\alpha, \beta > 0$ and $\phi(x), \Phi(x)$ denote the probability density and cumulative probability
 * functions of the [normal distribution]{@link #dist.Normal}.
 * Support: $x > 0$.
 *
 * @class Alpha
 * @memberof ran.dist
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @param {number=} beta Scale parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  // Source: Johnson, Kotz, and Balakrishnan (1994). Continuous Univariate Distributions — Volume 1, Second Edition,
  // John Wiley and Sons, p. 173.
  constructor (alpha = 1, beta = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { alpha, beta }
    Distribution.validate({ alpha, beta }, [
      'alpha > 0',
      'beta > 0'
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
    return this.p.beta * Math.exp(-0.5 * Math.pow(this.p.alpha - this.p.beta / x, 2)) / (x * x * this.c[1])
  }

  _cdf (x) {
    return this._phi(this.p.alpha - this.p.beta / x) / this.c[0]
  }

  _q (p) {
    return this.p.beta / (this.p.alpha - this._phiInv(p * this.c[0]))
  }
}
