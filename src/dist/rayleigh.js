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

    // decisions/0018-continuous-subclass-natural-params.md — natural params only in this.p
    this.p = { sigma }
    Object.assign(this.c, { lambda2: sigma * Math.SQRT2 })
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return this.p.sigma * Math.sqrt(Math.PI / 2)
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    return (4 - Math.PI) / 2 * this.p.sigma * this.p.sigma
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    // 2√π(π−3)/(4−π)^(3/2) — fixed constant independent of sigma
    return 2 * Math.sqrt(Math.PI) * (Math.PI - 3) / Math.pow(4 - Math.PI, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    // (32−3π²)/(4−π)² − 3 — fixed constant independent of sigma
    const d = 4 - Math.PI
    return (32 - 3 * Math.PI * Math.PI) / (d * d) - 3
  }

  _generator () {
    return this._q(this.r.next())
  }

  _pdf (x) {
    const t = x / this.c.lambda2
    return 2 * t * Math.exp(-t * t) / this.c.lambda2
  }

  _cdf (x) {
    const t = x / this.c.lambda2
    return 1 - Math.exp(-t * t)
  }

  _q (p) {
    return this.c.lambda2 * Math.sqrt(-Math.log(1 - p))
  }

  static get _fitInitIsExact () {
    // _fitInit returns the exact closed-form MLE, so fit() skips the optimizer (ADR-0016).
    return true
  }

  static _fitInit (data) {
    // MLE: σ = sqrt(mean(x²) / 2) from second-moment E[X²] = 2σ²
    const n = data.length
    return [Math.sqrt(data.reduce((s, x) => s + x * x, 0) / (2 * n))]
  }
}
