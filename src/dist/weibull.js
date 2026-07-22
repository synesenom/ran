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

    // Weibull has 2 free parameters (lambda, k); override the 1 inherited from Exponential
    this.k = 2

    // decisions/0018-continuous-subclass-natural-params.md — natural params only in this.p;
    // this.c.expNegLambda (= exp(-1), set by Exponential's own super(1) call) already holds the
    // dummy rate-1 constant that _pdf/_cdf inline below need — no new this.c value required.
    /** @type {*} */
    this.p = { lambda, k }
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

    // Speed-up constants (merged: Exponential's constructor already set this.c.expNegLambda,
    // which Weibull's _pdf/_cdf inline directly)
    Object.assign(this.c, {
      g1: gamma(1 + 1 / k),
      g2: gamma(1 + 2 / k),
      g3: gamma(1 + 3 / k),
      g4: gamma(1 + 4 / k)
    })
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return this.p.lambda * this.c.g1
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const { g1, g2 } = this.c
    return this.p.lambda * this.p.lambda * (g2 - g1 * g1)
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const { g1, g2, g3 } = this.c
    const v = g2 - g1 * g1
    return (g3 - 3 * g2 * g1 + 2 * g1 * g1 * g1) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const { g1, g2, g3, g4 } = this.c
    const v = g2 - g1 * g1
    return (g4 - 4 * g3 * g1 + 6 * g2 * g1 * g1 - 3 * Math.pow(g1, 4)) / (v * v) - 3
  }

  _generator () {
    // Inverse transform sampling.
    return this._q(this.r.next())
  }

  // Exponential.prototype._pdf/_cdf read this.p.lambda directly (unlike Beta's this.c-only _pdf),
  // so once this.p.lambda holds the real scale (not the dummy rate-1 passed to super(1)),
  // delegating to super._pdf/_cdf would evaluate the wrong-rate exponential; inlined instead using
  // the dummy's cached this.c.expNegLambda (= exp(-1)).
  _pdf (x) {
    const t = x / this.p.lambda
    return this.p.k * Math.pow(t, this.p.k - 1) * Math.pow(this.c.expNegLambda, Math.pow(t, this.p.k)) / this.p.lambda
  }

  _cdf (x) {
    return -Math.expm1(-Math.pow(x / this.p.lambda, this.p.k))
  }

  _q (p) {
    return this.p.lambda * Math.pow(-Math.log(1 - p), 1 / this.p.k)
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
