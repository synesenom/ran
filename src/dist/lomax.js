import Distribution from './_distribution'

/**
 * Generator for the [Lomax distribution]{@link https://en.wikipedia.org/wiki/Lomax_distribution}:
 *
 * $$f(x; \lambda, \alpha) = \frac{\alpha}{\lambda}\bigg[1 + \frac{x}{\lambda}\bigg]^{-(\alpha + 1)},$$
 *
 * with \(\lambda, \alpha \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+ \cup \{0\}\).
 *
 * @class Lomax
 * @memberOf ran.dist
 * @param {number=} lambda Scale parameter. Default value is 1.
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (lambda = 1, alpha = 1) {
    super('continuous', arguments.length)
    this.p = { lambda, alpha }
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    return this.p.lambda * (Math.pow(this.r.next(), -1 / this.p.alpha) - 1)
  }

  _pdf (x) {
    return this.p.alpha * Math.pow(1 + x / this.p.lambda, -1 - this.p.alpha) / this.p.lambda
  }

  _cdf (x) {
    return 1 - Math.pow(1 + x / this.p.lambda, -this.p.alpha)
  }
}
