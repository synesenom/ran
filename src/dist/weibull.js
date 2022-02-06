import Exponential from './exponential'
import Distribution from './_distribution'

/**
 * Generator for the [Weibull distribution]{@link https://en.wikipedia.org/wiki/Weibull_distribution}:
 *
 * $$f(x; \lambda, k) = \frac{k}{\lambda}\bigg(\frac{x}{\lambda}\bigg)^{k - 1} e^{-(x / \lambda)^k},$$
 *
 * with $\lambda, k > 0$. Support: $x \ge 0$.
 *
 * @class Weibull
 * @memberof ran.dist
 * @param {number=} lambda Scale parameter. Default value is 1.
 * @param {number=} k Shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Exponential {
  // Transformation of exponential distribution
  constructor (lambda = 1, k = 1) {
    super(1)

    // Validate parameters
    this.p = Object.assign(this.p, { lambda2: lambda, k })
    Distribution.validate({ lambda, k }, [
      'lambda > 0',
      'k > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: k >= 1
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling.
    return this._q(this.r.next())
  }

  _pdf (x) {
    const t = x / this.p.lambda2
    return this.p.k * Math.pow(t, this.p.k - 1) * super._pdf(Math.pow(t, this.p.k)) / this.p.lambda2
  }

  _cdf (x) {
    return super._cdf(Math.pow(x / this.p.lambda2, this.p.k))
  }

  _q (p) {
    return this.p.lambda2 * Math.pow(-Math.log(1 - p), 1 / this.p.k)
  }
}
