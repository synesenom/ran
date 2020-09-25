import Distribution from './_distribution'

/**
 * Generator for the [Lomax distribution]{@link https://en.wikipedia.org/wiki/Lomax_distribution}:
 *
 * $$f(x; \lambda, \alpha) = \frac{\alpha}{\lambda}\bigg\[1 + \frac{x}{\lambda}\bigg\]^{-(\alpha + 1)},$$
 *
 * with $\lambda, \alpha > 0$. Support: $x \ge 0$.
 *
 * @class Lomax
 * @memberof ran.dist
 * @param {number=} lambda Scale parameter. Default value is 1.
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (lambda = 1, alpha = 1) {
    super('continuous', arguments.length)

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
    return 1 - Math.pow(1 + x / this.p.lambda, -this.p.alpha)
  }

  _q (p) {
    return this.p.lambda * (Math.pow(1 - p, -1 / this.p.alpha) - 1)
  }
}
