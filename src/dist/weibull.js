import Distribution from './_distribution'

/**
 * Generator for the [Weibull distribution]{@link https://en.wikipedia.org/wiki/Weibull_distribution}:
 *
 * $$f(x; \lambda, k) = \frac{k}{\lambda}\bigg(\frac{x}{\lambda}\bigg)^{k - 1} e^{-(x / \lambda)^k},$$
 *
 * with \(\lambda, k \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+ \cup \{0\}\).
 *
 * @class Weibull
 * @memberOf ran.dist
 * @param {number=} lambda Scale parameter. Default value is 1.
 * @param {number=} k Shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (lambda = 1, k = 1) {
    super('continuous', arguments.length)
    this.p = { lambda, k }
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
    return this.p.lambda * Math.pow(-Math.log(Math.random()), 1 / this.p.k)
  }

  _pdf (x) {
    return (this.p.k / this.p.lambda) * Math.exp((this.p.k - 1) * Math.log(x / this.p.lambda) - Math.pow(x / this.p.lambda, this.p.k))
  }

  _cdf (x) {
    return 1 - Math.exp(-Math.pow(x / this.p.lambda, this.p.k))
  }
}
