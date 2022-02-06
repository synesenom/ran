import Weibull from './weibull'
import Distribution from './_distribution'

/**
 * Generator for the [exponentiated Weibull distribution]{@link https://en.wikipedia.org/wiki/Exponentiated_Weibull_distribution}:
 *
 * $$f(x; \lambda, k) = \alpha \frac{k}{\lambda}\bigg(\frac{x}{\lambda}\bigg)^{k - 1} \bigg[1 - e^{-(x / \lambda)^k}\bigg]^{\alpha - 1} e^{-(x / \lambda)^k},$$
 *
 * with $\lambda, k, \alpha > 0$. Support: $x \ge 0$.
 *
 * @class ExponentiatedWeibull
 * @memberof ran.dist
 * @param {number=} lambda Scale parameter. Default value is 1.
 * @param {number=} k First shape parameter. Default value is 1.
 * @param {number=} alpha Second shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Weibull {
  // Transformation of Weibull distribution.
  constructor (lambda = 1, k = 1, alpha = 1) {
    super(lambda, k)

    // Validate parameters.
    this.p = Object.assign(this.p, { lambda2: lambda, alpha })
    Distribution.validate({ lambda, k, alpha }, [
      'lambda > 0',
      'k > 0',
      'alpha > 0'
    ])

    // Set support.
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
    return super._pdf(x) * this.p.alpha * Math.pow(this._cdf(x), (this.p.alpha - 1) / this.p.alpha)
  }

  _cdf (x) {
    return Math.pow(super._cdf(x), this.p.alpha)
  }

  _q (p) {
    return super._q(Math.pow(p, 1 / this.p.alpha))
  }
}
