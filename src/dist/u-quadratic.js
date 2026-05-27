import Distribution from './_distribution'

/**
 * Probability function for the [u-quadratic distribution]{@link https://en.wikipedia.org/wiki/U-quadratic_distribution}:
 *
 * $f(x; a, b) = \alpha (x - \beta)^2,$
 *
 * where $\alpha = \frac{12}{(b - a)^3}$, $\beta = \frac{a + b}{2}$, $a, b \in \mathbb{R}$ and $a < b$.
 * Support: $x \in \[a, b\]$.
 *
 * @class UQuadratic
 * @memberof ran.dist
 * @constructor
 */
export default class UQuadratic extends Distribution {
  /**
   * @param {number} a Lower bound of the support.
   * @param {number} b Upper bound of the support.
   */
  constructor (a, b) {
    super('continuous', 2)

    // Validate parameters
    this.p = { a, b }
    Distribution.validate({ a, b }, [
      'a < b'
    ])

    // Set support
    this.s = [{
      value: a,
      closed: true
    }, {
      value: b,
      closed: true
    }]

    // Speed-up constants
    this.c = {
      alpha: 12 / Math.pow(b - a, 3),
      beta: (a + b) / 2,
      halfRangeCubed: Math.pow((b - a) / 2, 3)
    }
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return this.c.alpha * Math.pow(x - this.c.beta, 2)
  }

  _cdf (x) {
    return this.c.alpha * (Math.pow(x - this.c.beta, 3) + this.c.halfRangeCubed) / 3
  }

  _q (p) {
    return Math.cbrt(3 * p / this.c.alpha - this.c.halfRangeCubed) + this.c.beta
  }
}
