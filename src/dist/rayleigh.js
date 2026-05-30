import Weibull from './weibull'

/**
 * Probability density function for the [Rayleigh distribution]{@link https://en.wikipedia.org/wiki/Rayleigh_distribution}:
 *
 * $f(x; \sigma) = \frac{x}{\sigma^2} e^{-\frac{x^2}{2\sigma^2}},$
 *
 * with $\sigma > 0$. Support: $x \ge 0$.
 *
 * @class Rayleigh
 * @memberof ran.dist
 * @constructor
 */
export default class Rayleigh extends Weibull {
  // Special case of Weibull
  /**
   * @param {number} sigma Scale parameter.
   */
  constructor (sigma) {
    super(sigma * Math.SQRT2, 2)

    // Rayleigh has 1 free parameter (sigma); override the 2 inherited from Weibull
    this.k = 1
  }

  static _fitInit (data) {
    // MLE: σ = sqrt(mean(x²) / 2) from second-moment E[X²] = 2σ²
    const n = data.length
    return [Math.sqrt(data.reduce((s, x) => s + x * x, 0) / (2 * n))]
  }
}
