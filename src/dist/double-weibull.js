import Weibull from './weibull'
import { gamma } from '../special'

/**
 * Probability density function for the [double Weibull distribution]{@link https://docs.scipy.org/doc/scipy/tutorial/stats/continuous_dweibull.html}:
 *
 * $f(x; \lambda, k) = \frac{k}{\lambda}\bigg(\frac{|x|}{\lambda}\bigg)^{k - 1} e^{-(|x| / \lambda)^k},$
 *
 * with $\lambda, k > 0$. Support: $x \in \mathbb{R}$.
 *
 * @class DoubleWeibull
 * @memberof ran.dist
 * @constructor
 */
export default class DoubleWeibull extends Weibull {
  // Transformation of Weibull
  /**
   * @param {number} lambda Scale parameter.
   * @param {number} k Shape parameter.
   */
  constructor (lambda, k) {
    super(lambda, k)

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]

    // decisions/0018-continuous-subclass-natural-params.md — natural params only in this.p
    this.p = { lambda, k }
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return 0
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    // E[X²] = λ²·Γ(1+2/k); mean = 0 so Var = E[X²]
    return this.p.lambda * this.p.lambda * gamma(1 + 2 / this.p.k)
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    return 0
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const g2 = gamma(1 + 2 / this.p.k)
    const g4 = gamma(1 + 4 / this.p.k)
    return g4 / (g2 * g2) - 3
  }

  _generator () {
    // super._generator() calls Weibull._generator = this._q(r.next()), which resolves to
    // DoubleWeibull._q after the fix; the trailing ±1 flip is harmless for a symmetric distribution
    return super._generator() * (this.r.next() < 0.5 ? -1 : 1)
  }

  _pdf (x) {
    const t = Math.abs(x) / this.p.lambda
    return this.p.k / (2 * this.p.lambda) * Math.pow(t, this.p.k - 1) * Math.exp(-Math.pow(t, this.p.k))
  }

  _cdf (x) {
    const y = 1 - Math.exp(-Math.pow(Math.abs(x) / this.p.lambda, this.p.k))
    return (x > 0 ? 1 + y : 1 - y) / 2
  }

  _q (p) {
    return p > 0.5
      ? this.p.lambda * Math.pow(-Math.log(2 - 2 * p), 1 / this.p.k)
      : -(this.p.lambda * Math.pow(-Math.log(2 * p), 1 / this.p.k))
  }

  static _fitInit (data) {
    // |X| ~ Weibull(λ, k): apply Weibull Justus init to absolute values of the symmetric data
    return super._fitInit(data.map(x => Math.abs(x)))
  }
}
