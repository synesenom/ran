import Weibull from './weibull'
import Distribution from './_distribution'
import { gamma } from '../special'

/**
 * Probability density function for the [exponentiated Weibull distribution]{@link https://en.wikipedia.org/wiki/Exponentiated_Weibull_distribution}:
 *
 * $f(x; \lambda, k) = \alpha \frac{k}{\lambda}\bigg(\frac{x}{\lambda}\bigg)^{k - 1} \bigg[1 - e^{-(x / \lambda)^k}\bigg]^{\alpha - 1} e^{-(x / \lambda)^k},$
 *
 * with $\lambda, k, \alpha > 0$. Support: $x \ge 0$.
 *
 * @class ExponentiatedWeibull
 * @memberof ran.dist
 * @constructor
 */
export default class ExponentiatedWeibull extends Weibull {
  // Transformation of Weibull distribution.
  /**
   * @param {number} lambda Scale parameter.
   * @param {number} k First shape parameter.
   * @param {number} alpha Second shape parameter.
   */
  constructor (lambda, k, alpha) {
    super(lambda, k)

    // ExponentiatedWeibull has 3 free parameters (lambda, k, alpha); override the 2 inherited from Weibull
    this.k = 3

    // Validate parameters.
    // Weibull (fixed) already sets this.p = { lambda, k } with the real lambda — no leaked/dummy
    // key to drop, so adding alpha is a plain read-then-replace, not a merge.
    this.p = { lambda: this.p.lambda, k: this.p.k, alpha }
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

    // Speed-up constants: e1..e4 are shared verbatim by mean/variance/skewness/kurtosis
    // (each previously re-ran its own 500-term series independently). Merged: Weibull's
    // constructor already cached g1..g4/expNegLambda.
    Object.assign(this.c, {
      e1: this._ewRawMoment(1),
      e2: this._ewRawMoment(2),
      e3: this._ewRawMoment(3),
      e4: this._ewRawMoment(4)
    })
  }

  _ewRawMoment (n) {
    // E[X^n] = λ^n · α · Γ(1+n/k) · Σ_{j=0}^{∞} (−1)^j · C(α−1,j) / (j+1)^{1+n/k}
    // Generalized binomial series; terminates in O(α) steps for integer α
    const { lambda, k, alpha } = this.p
    const gn = gamma(1 + n / k)
    let s = 0
    let binom = 1
    for (let j = 0; j < 500; j++) {
      const term = binom / Math.pow(j + 1, 1 + n / k)
      s += j % 2 === 0 ? term : -term
      if (Math.abs(term) < 1e-15 * Math.abs(s) && j > 0) break
      binom *= (alpha - 1 - j) / (j + 1)
    }
    return Math.pow(lambda, n) * alpha * gn * s
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return this.c.e1
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const { e1, e2 } = this.c
    return e2 - e1 * e1
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const { e1, e2, e3 } = this.c
    const v = e2 - e1 * e1
    return (e3 - 3 * e1 * e2 + 2 * e1 * e1 * e1) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const { e1, e2, e3, e4 } = this.c
    const v = e2 - e1 * e1
    return (e4 - 4 * e1 * e3 + 6 * e1 * e1 * e2 - 3 * Math.pow(e1, 4)) / (v * v) - 3
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
    return this.p.lambda * Math.pow(-Math.log(1 - Math.pow(p, 1 / this.p.alpha)), 1 / this.p.k)
  }

  static _fitInit (data) {
    // alpha=1 collapses to Weibull; seed Nelder-Mead with Weibull Justus estimate and alpha=1
    const [lambda, k] = super._fitInit(data)
    return [lambda, k, 1]
  }
}
