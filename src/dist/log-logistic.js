import Distribution from './_distribution'

/**
 * Generator for the [log-logistic distribution]{@link https://en.wikipedia.org/wiki/Log-logistic_distribution} (also known as Fisk distribution):
 *
 * $$f(x; \alpha, \beta) = \frac{(\beta / \alpha) (x / \alpha)^{\beta - 1}}{([1 + (x / \alpha)^\beta]^2},$$
 *
 * with \(\alpha, \beta \in \mathbb{R}^+\). Support: \(x \in [0, \infty)\).
 *
 * @class LogLogistic
 * @memberOf ran.dist
 * @param {number=} alpha Scale parameter. Default value is 1.
 * @param {number=} beta Shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (alpha = 1, beta = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { alpha, beta }
    this._validate({ alpha, beta }, [
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
      beta / alpha
    ]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    let xa = x / this.p.alpha
    let y = Math.pow(xa, this.p.beta - 1)
    return this.c[0] * y / Math.pow(1 + xa * y, 2)
  }

  _cdf (x) {
    return 1 / (1 + Math.pow(x / this.p.alpha, -this.p.beta))
  }

  _q (p) {
    return this.p.alpha * Math.pow(1 / p - 1, -1 / this.p.beta)
  }
}
