import Exponential from './exponential'
import Distribution from './_distribution'
import { gamma } from '../special'

/**
 * Probability density function for the [Weibull distribution]{@link https://en.wikipedia.org/wiki/Weibull_distribution}:
 *
 * $f(x; \lambda, k) = \frac{k}{\lambda}\bigg(\frac{x}{\lambda}\bigg)^{k - 1} e^{-(x / \lambda)^k},$
 *
 * with $\lambda, k > 0$. Support: $x \ge 0$.
 *
 * @class Weibull
 * @memberof ran.dist
 * @constructor
 */
export default class Weibull extends Exponential {
  // Transformation of exponential distribution
  /**
   * @param {number} lambda Scale parameter.
   * @param {number} k Shape parameter.
   */
  constructor (lambda, k) {
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

  static _fitInit (data) {
    // Justus approximation: k ≈ 1.2*(cv)^{-1.086} relates the Weibull CV to its shape parameter
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1
    const cv = Math.sqrt(variance) / Math.max(mean, 1e-9)
    const k = Math.max(1.2 * Math.pow(cv, -1.086), 0.1)
    return [Math.max(mean / gamma(1 + 1 / k), 1e-3), k]
  }
}
