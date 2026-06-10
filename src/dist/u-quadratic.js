import Distribution from './_distribution'

/**
 * Probability density function for the [u-quadratic distribution]{@link https://en.wikipedia.org/wiki/U-quadratic_distribution}:
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

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return this.c.beta
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const r = (this.p.b - this.p.a) / 2
    return 3 * r * r / 5
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    return 0
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    return -38 / 21
  }

  static _fitInit (data) {
    // MLEs for bounded-support endpoints are the sample extremes; small buffer satisfies a < b
    const lo = Math.min(...data)
    const hi = Math.max(...data)
    const eps = (hi - lo) * 0.01 || 1e-6
    return [lo - eps, hi + eps]
  }
}
