import Weibull from './weibull'

/**
 * Generator for the [double Weibull distribution]{@link https://docs.scipy.org/doc/scipy/tutorial/stats/continuous_dweibull.html}:
 *
 * $$f(x; \lambda, k) = \frac{k}{\lambda}\bigg(\frac{|x|}{\lambda}\bigg)^{k - 1} e^{-(|x| / \lambda)^k},$$
 *
 * with $\lambda, k > 0$. Support: $x \in \mathbb{R}$.
 *
 * @class DoubleWeibull
 * @memberof ran.dist
 * @param {number=} lambda Scale parameter. Default value is 1.
 * @param {number=} k Shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Weibull {
  // Transformation of Weibull
  constructor (lambda = 1, k = 1) {
    super(lambda, k)

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    return super._generator() * (this.r.next() < 0.5 ? -1 : 1)
  }

  _pdf (x) {
    return super._pdf(Math.abs(x)) / 2
  }

  _cdf (x) {
    const y = super._cdf(Math.abs(x))
    return (x > 0 ? 1 + y : 1 - y) / 2
  }

  _q (p) {
    return p > 0.5
      ? super._q(2 * p - 1)
      : -super._q(1 - 2 * p)
  }
}
