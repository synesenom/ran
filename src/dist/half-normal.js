import Normal from './normal'
import { erfinv } from '../special'

/**
 * Probability density function for the [half-normal distribution]{@link https://en.wikipedia.org/wiki/Half-normal_distribution}:
 *
 * $f(x; \sigma) = \frac{\sqrt{2}}{\sigma\sqrt{\pi}} e^{-\frac{x^2}{2\sigma^2}},$
 *
 * with $\sigma > 0$. Support: $x \ge 0$.
 *
 * @class HalfNormal
 * @memberof ran.dist
 * @constructor
 */
export default class HalfNormal extends Normal {
  // Transformation of normal distribution
  /**
   * @param {number} sigma Scale parameter.
   */
  constructor (sigma) {
    super(0, sigma)

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling by transforming normal variate
    return Math.abs(super._generator())
  }

  _pdf (x) {
    return 2 * super._pdf(x)
  }

  _cdf (x) {
    return 2 * super._cdf(x) - 1
  }

  _q (p) {
    return this.p.sigma * 1.414213562373095 * erfinv(p)
  }

  /**
   * @returns {number} Mean of the distribution.
   */
  mean () {
    return this.p.sigma * Math.sqrt(2 / Math.PI)
  }

  /**
   * @returns {number} Variance of the distribution.
   */
  variance () {
    return this.p.sigma ** 2 * (1 - 2 / Math.PI)
  }

  /**
   * @returns {number} Skewness of the distribution.
   */
  skewness () {
    return Math.SQRT2 * (4 - Math.PI) / Math.pow(Math.PI - 2, 1.5)
  }

  /**
   * @returns {number} Excess kurtosis of the distribution.
   */
  kurtosis () {
    return 8 * (Math.PI - 3) / (Math.PI - 2) ** 2
  }

  static get _fitInitIsExact () {
    // _fitInit returns the exact closed-form MLE, so fit() skips the optimizer (ADR-0016).
    return true
  }

  static _fitInit (data) {
    // MLE: σ = sqrt(mean(x²)) from second-moment E[X²] = σ²
    const n = data.length
    return [Math.sqrt(data.reduce((s, x) => s + x * x, 0) / n)]
  }
}
