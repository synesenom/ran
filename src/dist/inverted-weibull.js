import Distribution from './_distribution'
import { gamma } from '../special'

/**
 * Probability density function for the [inverted Weibull distribution]{@link https://docs.scipy.org/doc/scipy/tutorial/stats/continuous_invweibull.html}:
 *
 * $f(x; c) = c x^{-c - 1} e^{-x^{-c}},$
 *
 * with $c > 0$. Support: $x \ge 0$.
 *
 * @class InvertedWeibull
 * @memberof ran.dist
 * @constructor
 */
export default class InvertedWeibull extends Distribution {
  /**
   * @param {number} c Shape parameter.
   */
  constructor (c) {
    super('continuous', 1)

    // Validate parameters
    this.p = { c }
    Distribution.validate({ c }, [
      'c > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    // g1..g4 are shared verbatim by mean/variance/skewness/kurtosis; guarded moment methods
    // below may never read some of these when c is too small, but gamma() never throws.
    this.c = {
      g1: gamma(1 - 1 / c),
      g2: gamma(1 - 2 / c),
      g3: gamma(1 - 3 / c),
      g4: gamma(1 - 4 / c)
    }
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    // E[X] = Γ(1−1/c); exists only for c > 1
    return this.p.c > 1 ? this.c.g1 : Infinity
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    if (this.p.c <= 2) return Infinity
    const { g1, g2 } = this.c
    return g2 - g1 * g1
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    if (this.p.c <= 3) return Infinity
    const { g1, g2, g3 } = this.c
    const v = g2 - g1 * g1
    return (g3 - 3 * g2 * g1 + 2 * g1 * g1 * g1) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    if (this.p.c <= 4) return Infinity
    const { g1, g2, g3, g4 } = this.c
    const v = g2 - g1 * g1
    return (g4 - 4 * g3 * g1 + 6 * g2 * g1 * g1 - 3 * Math.pow(g1, 4)) / (v * v) - 3
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    // 0^(-c-1) * exp(-inf) = inf * 0 = NaN; the mathematical limit as x→0+ is 0
    if (x === 0) return 0
    return this.p.c * Math.pow(x, -1 - this.p.c) * Math.exp(-1 / Math.pow(x, this.p.c))
  }

  _cdf (x) {
    return Math.exp(-1 / Math.pow(x, this.p.c))
  }

  _q (p) {
    return Math.pow(-Math.log(p), -1 / this.p.c)
  }

  static _fitInit (data) {
    // 1/X ~ Weibull(1, c) when X ~ InvertedWeibull(c): Justus approximation on reciprocals yields c
    const n = data.length
    const recip = data.map(x => 1 / x)
    const mean = recip.reduce((s, x) => s + x, 0) / n
    const variance = recip.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1
    const cv = Math.sqrt(variance) / Math.max(mean, 1e-9)
    return [Math.max(1.2 * Math.pow(cv, -1.086), 0.1)]
  }
}
