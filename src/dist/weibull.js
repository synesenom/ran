import Exponential from './exponential'

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
export default class extends Exponential {
  // Transformation of exponential distribution
  constructor (lambda = 1, k = 1) {
    super(1)
    this.p = Object.assign({ lambda2: lambda, k }, this.p)
    this.s = [{
      value: 0,
      closed: k >= 1
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling by transforming exponential variate
    return this.p.lambda2 * Math.pow(super._generator(), 1 / this.p.k)
  }

  _pdf (x) {
    return this.p.k * Math.pow(x / this.p.lambda2, this.p.k - 1) * super._pdf(Math.pow(x / this.p.lambda2, this.p.k)) / this.p.lambda2
  }

  _cdf (x) {
    return super._cdf(Math.pow(x / this.p.lambda2, this.p.k))
  }

  _q (p) {
    return this.p.lambda2 * Math.pow(-Math.log(1 - p), 1 / this.p.k)
  }
}
