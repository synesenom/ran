import gamma from './_gamma'
import Beta from './beta'

/**
 * Probability density function for the [beta prime distribution]{@link https://en.wikipedia.org/wiki/Beta_prime_distribution} (also
 * known as inverted beta):
 *
 * $f(x; \alpha, \beta) = \frac{x^{\alpha - 1}(1 + x)^{-\alpha - \beta}}{\mathrm{B}(\alpha, \beta)},$
 *
 * with $\alpha, \beta > 0$ and $\mathrm{B}(x, y)$ is the beta function.
 * Support: $x > 0$.
 *
 * @class BetaPrime
 * @memberof ran.dist
 * @constructor
 */
export default class BetaPrime extends Beta {
  // Transformation of beta distribution
  /**
   * @param {number} alpha First shape parameter.
   * @param {number} beta Second shape parameter.
   */
  constructor (alpha, beta) {
    super(alpha, beta)

    // Set support
    this.s = [{
      value: 0,
      closed: alpha >= 1
    }, {
      value: Infinity,
      closed: false
    }]
  }

  static _fitInit (data) {
    // y = x/(1+x) maps BetaPrime's (0,∞) support to (0,1); Beta MOM in that space recovers (α,β)
    const n = data.length
    const y = data.map(x => x / (1 + x))
    const mean = y.reduce((s, x) => s + x, 0) / n
    const variance = y.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1e-4
    const factor = Math.max(mean * (1 - mean) / variance - 1, 0.1)
    return [mean * factor, (1 - mean) * factor]
  }

  _generator () {
    // Direct sampling from gamma (ignoring super)
    const x = gamma(this.r, this.p.alpha, 1)

    const y = gamma(this.r, this.p.beta, 1)
    return x / y
  }

  _pdf (x) {
    return super._pdf(x / (1 + x)) / Math.pow(1 + x, 2)
  }

  _cdf (x) {
    return super._cdf(x / (1 + x))
  }

  /**
   * @returns {number} The mean of the distribution, or `Infinity` when `beta <= 1`.
   */
  mean () {
    return this.p.beta > 1 ? this.p.alpha / (this.p.beta - 1) : Infinity
  }

  /**
   * @returns {number} The variance of the distribution, or `Infinity` when `beta <= 2`.
   */
  variance () {
    const { alpha, beta } = this.p
    return beta > 2
      ? alpha * (alpha + beta - 1) / ((beta - 2) * (beta - 1) ** 2)
      : Infinity
  }

  /**
   * @returns {number} The skewness of the distribution, or `Infinity` when `beta <= 3`.
   */
  skewness () {
    const { alpha, beta } = this.p
    if (beta <= 3) return Infinity
    return 2 * (2 * alpha + beta - 1) / (beta - 3) *
      Math.sqrt((beta - 2) / (alpha * (alpha + beta - 1)))
  }

  /**
   * @returns {number} The excess kurtosis of the distribution, or `Infinity` when `beta <= 4`.
   */
  kurtosis () {
    const { alpha, beta } = this.p
    if (beta <= 4) return Infinity
    return 6 * (alpha * (alpha + beta - 1) * (5 * beta - 11) + (beta - 1) ** 2 * (beta - 2)) /
      (alpha * (alpha + beta - 1) * (beta - 3) * (beta - 4))
  }
}
