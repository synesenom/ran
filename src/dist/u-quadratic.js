import Distribution from './_distribution'

/**
 * Generator for the [u-quadratic distribution]{@link https://en.wikipedia.org/wiki/U-quadratic_distribution}:
 *
 * $$f(x; a, b) = \alpha (x - \beta)^2,$$
 *
 * where \(\alpha = \frac{12}{(b - a)^3}\), \(\beta = \frac{a + b}{2}\), \(a, b \in \mathbb{R}\) and \(a < b\). Support: \(x \in [1, b]\).
 *
 * @class UQuadratic
 * @memberof ran.dist
 * @param {number=} a Lower bound of the support. Default value is 0.
 * @param {number=} b Upper bound of the support. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (a = 0, b = 1) {
    super('continuous', arguments.length)

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
    this.c = [
      12 / Math.pow(b - a, 3),
      (a + b) / 2,
      Math.pow((b - a) / 2, 3)
    ]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return this.c[0] * Math.pow(x - this.c[1], 2)
  }

  _cdf (x) {
    return this.c[0] * (Math.pow(x - this.c[1], 3) + this.c[2]) / 3
  }

  _q (p) {
    return Math.cbrt(3 * p / this.c[0] - this.c[2]) + this.c[1]
  }
}
