import Distribution from './_distribution'

/**
 * Probability density function for the [Lomax distribution]{@link https://en.wikipedia.org/wiki/Lomax_distribution}:
 *
 * $f(x; \lambda, \alpha) = \frac{\alpha}{\lambda}\bigg\[1 + \frac{x}{\lambda}\bigg\]^{-(\alpha + 1)},$
 *
 * with $\lambda, \alpha > 0$. Support: $x \ge 0$.
 *
 * Cumulative distribution function:
 *
 * $F(x; \lambda, \alpha) = 1 - \left(1 + \frac{x}{\lambda}\right)^{-\alpha}$
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

  static _fitInit (data) {
    // MOM: CV^2 = alpha/(alpha-2) links dispersion to tail index; lambda set via mean-alpha relation
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = Math.max(data.reduce((s, x) => s + (x - mean) ** 2, 0) / n, 1e-9)
    const cv2 = variance / Math.max(mean * mean, 1e-9)
    const alpha = cv2 > 1 ? 2 * cv2 / (cv2 - 1) : 3
    return [Math.max(mean * (alpha - 1), 1e-3), alpha]
  }
}
