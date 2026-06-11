import Distribution from './_distribution'
import { gamma } from '../special'

/**
 * Probability density function for the [Frechet distribution]{@link https://en.wikipedia.org/wiki/Frechet_distribution}:
 *
 * $f(x; \alpha, s, m) = \frac{\alpha z^{-1 -\alpha} e^{-z^{-\alpha}}}{s},$
 *
 * with $z = \frac{x - m}{s}$. and $\alpha, s > 0$, $m \in \mathbb{R}$. Support: $x \in \mathbb{R}, x > m$.
 *
 * @class Frechet
 * @memberof ran.dist
 * @constructor
 */
export default class Frechet extends Distribution {
  /**
   * @param {number} alpha Shape parameter.
   * @param {number} s Scale parameter.
   * @param {number} m Location parameter.
   */
  constructor (alpha, s, m) {
    super('continuous', 3)

    // Validate parameters
    this.p = { alpha, s, m }
    Distribution.validate({ alpha, s, m }, [
      'alpha > 0',
      's > 0'
    ])

    // Set support
    this.s = [{
      value: m,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    // E[X] = m + s·Γ(1−1/α); exists only for α > 1
    return this.p.alpha > 1 ? this.p.m + this.p.s * gamma(1 - 1 / this.p.alpha) : Infinity
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    if (this.p.alpha <= 2) return Infinity
    const g1 = gamma(1 - 1 / this.p.alpha)
    const g2 = gamma(1 - 2 / this.p.alpha)
    return this.p.s * this.p.s * (g2 - g1 * g1)
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    if (this.p.alpha <= 3) return Infinity
    const g1 = gamma(1 - 1 / this.p.alpha)
    const g2 = gamma(1 - 2 / this.p.alpha)
    const g3 = gamma(1 - 3 / this.p.alpha)
    const v = g2 - g1 * g1
    return (g3 - 3 * g2 * g1 + 2 * g1 * g1 * g1) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    if (this.p.alpha <= 4) return Infinity
    const g1 = gamma(1 - 1 / this.p.alpha)
    const g2 = gamma(1 - 2 / this.p.alpha)
    const g3 = gamma(1 - 3 / this.p.alpha)
    const g4 = gamma(1 - 4 / this.p.alpha)
    const v = g2 - g1 * g1
    return (g4 - 4 * g3 * g1 + 6 * g2 * g1 * g1 - 3 * Math.pow(g1, 4)) / (v * v) - 3
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const z = (x - this.p.m) / this.p.s
    return this.p.alpha * Math.exp(-Math.log(z) * (1 + this.p.alpha) - Math.pow(z, -this.p.alpha)) / this.p.s
  }

  _cdf (x) {
    return Math.exp(-Math.pow((x - this.p.m) / this.p.s, -this.p.alpha))
  }

  _q (p) {
    return this.p.m + this.p.s * Math.pow(-Math.log(p), -1 / this.p.alpha)
  }

  static _fitInit (data) {
    // Shift by m = min-ε so (X-m)/s ~ InvertedWeibull(alpha); Justus on reciprocals gives alpha
    const sorted = [...data].sort((a, b) => a - b)
    const n = sorted.length
    const m = sorted[0] - 1e-3
    const shifted = sorted.map(x => x - m)
    const recip = shifted.map(x => 1 / x)
    const meanR = recip.reduce((s, x) => s + x, 0) / n
    const varianceR = recip.reduce((s, x) => s + (x - meanR) ** 2, 0) / n || 1
    const cv = Math.sqrt(varianceR) / Math.max(meanR, 1e-9)
    const alpha = Math.max(1.2 * Math.pow(cv, -1.086), 0.5)
    const meanY = shifted.reduce((s, x) => s + x, 0) / n
    // Mean of InvertedWeibull(alpha) = Γ(1-1/alpha) for alpha > 1
    const s = alpha > 1 ? Math.max(meanY / gamma(1 - 1 / alpha), 1e-3) : Math.max(meanY, 1e-3)
    return [alpha, s, m]
  }
}
