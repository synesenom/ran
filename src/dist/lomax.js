import Distribution from './_distribution'

/**
 * Probability function for the [Lomax distribution]{@link https://en.wikipedia.org/wiki/Lomax_distribution}:
 *
 * $f(x; \lambda, \alpha) = \frac{\alpha}{\lambda}\bigg\[1 + \frac{x}{\lambda}\bigg\]^{-(\alpha + 1)},$
 *
 * with $\lambda, \alpha > 0$. Support: $x \ge 0$.
 *
 * @class Lomax
 * @memberof ran.dist
 * @constructor
 */
export default class Lomax extends Distribution {
  /**
   * @param {number} lambda Scale parameter.
   * @param {number} alpha Shape parameter.
   */
  constructor (lambda, alpha) {
    super('continuous', 2)

    // Validate parameters
    this.p = { lambda, alpha }
    Distribution.validate({ lambda, alpha }, [
      'lambda > 0',
      'alpha > 0'
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

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return this.p.alpha * Math.pow(1 + x / this.p.lambda, -1 - this.p.alpha) / this.p.lambda
  }

  _cdf (x) {
    // -expm1(-alpha * log1p(x/lambda)) avoids cancellation when x/lambda is near 0
    return -Math.expm1(-this.p.alpha * Math.log1p(x / this.p.lambda))
  }

  _q (p) {
    return this.p.lambda * (Math.pow(1 - p, -1 / this.p.alpha) - 1)
  }
}
