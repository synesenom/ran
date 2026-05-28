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

  static _fitInit (data) {
    // MLE: σ = sqrt(mean(x²)) from second-moment E[X²] = σ²
    const n = data.length
    return [Math.sqrt(data.reduce((s, x) => s + x * x, 0) / n)]
  }
}
