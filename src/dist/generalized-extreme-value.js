import Distribution from './_distribution'
import { gamma } from '../special'

/**
 * Probability density function for the [generalized extreme value distribution]{@link https://en.wikipedia.org/wiki/Generalized_extreme_value_distribution}:
 *
 * $f(x; c) = (1 - cx)^{1 / c - 1} e^{-(1 - cx)^{1 / c}},$
 *
 * with $c \ne 0$. Support: $x \in (-\infty, 1 / c]$ if $c > 0$, $x \in [1 / c, \infty)$ otherwise.
 *
 * @class GeneralizedExtremeValue
 * @memberof ran.dist
 * @constructor
 */
export default class GeneralizedExtremeValue extends Distribution {
  /**
   * @param {number} c Shape parameter.
   */
  constructor (c) {
    super('continuous', 1)

    // Validate parameters
    this.p = { c }
    Distribution.validate({ c }, [
      'c != 0'
    ])

    // Set support
    this.s = [{
      value: c > 0 ? -Infinity : 1 / c,
      closed: c < 0
    }, {
      value: c > 0 ? 1 / c : Infinity,
      closed: c > 0
    }]

    // Speed-up constants
    // g1..g4 are shared verbatim by mean/variance/skewness/kurtosis; guarded moment methods
    // below may never read some of these when c is too small, but gamma() never throws.
    this.c = {
      g1: gamma(1 + c),
      g2: gamma(1 + 2 * c),
      g3: gamma(1 + 3 * c),
      g4: gamma(1 + 4 * c)
    }
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    // ranjs shape c maps to standard GEV shape ξ = −c; g_r = Γ(1+r·c)
    // mean = (g1−1)/ξ = (Γ(1+c)−1)/(−c); exists when c > −1
    if (this.p.c <= -1) return Infinity
    return (this.c.g1 - 1) / (-this.p.c)
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    if (this.p.c <= -0.5) return Infinity
    const { g1, g2 } = this.c
    return (g2 - g1 * g1) / (this.p.c * this.p.c)
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    if (this.p.c <= -1 / 3) return Infinity
    const { g1, g2, g3 } = this.c
    const v = g2 - g1 * g1
    // sign(ξ) = sign(−c) flips the skewness direction relative to the raw central-moment numerator
    return Math.sign(-this.p.c) * (g3 - 3 * g2 * g1 + 2 * g1 * g1 * g1) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    if (this.p.c <= -0.25) return Infinity
    const { g1, g2, g3, g4 } = this.c
    const v = g2 - g1 * g1
    return (g4 - 4 * g3 * g1 + 6 * g2 * g1 * g1 - 3 * Math.pow(g1, 4)) / (v * v) - 3
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return Math.exp(-Math.pow(1 - this.p.c * x, 1 / this.p.c)) * Math.pow(1 - this.p.c * x, 1 / this.p.c - 1)
  }

  _cdf (x) {
    return Math.exp(-Math.pow(1 - this.p.c * x, 1 / this.p.c))
  }

  _q (p) {
    return (1 - Math.pow(-Math.log(p), this.p.c)) / this.p.c
  }

  static _fitInit (data) {
    // GEV skewness exceeds the Gumbel limit (≈1.14) when c < 0 (heavier right tail)
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const m2 = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1
    const skewness = data.reduce((s, x) => s + Math.pow((x - mean) / Math.sqrt(m2), 3), 0) / n
    return [skewness > 1.14 ? -0.1 : 0.1]
  }
}
