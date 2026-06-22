import Dagum from './dagum'
import Distribution from './_distribution'
import { beta } from '../special'

/**
 * Probability density function for the [Mielke distribution]{@link https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.mielke.html#r7049b665a02e-2}:
 *
 * $f(x; k, s) = \frac{k x^{k - 1}}{(1 + x^s)^{1 + k/s}},$
 *
 * with $k, s > 0$. Support: $x > 0$. It can be viewed as a re-parametrization of the [Dagum distribution]{@link #dist.Dagum}.
 *
 * @class Mielke
 * @memberof ran.dist
 * @constructor
 */
export default class Mielke extends Dagum {
  /**
   * @param {number} k First shape parameter.
   * @param {number} s Second shape parameter.
   */
  constructor (k, s) {
    super(k / s, s, 1)

    // Mielke has 2 free parameters (k, s); override the 3 inherited from Dagum
    this.k = 2

    // Validate parameters
    Distribution.validate({ k, s }, [
      'k > 0',
      's > 0'
    ])

    // Dagum's constructor sets this.p = {p, a, b}; override with Mielke's own names
    this.p = { k, s }

    // Set support
    this.s = [{
      value: 0,
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
    const { k, s } = this.p
    return s > 1 ? (k / s) * beta((k + 1) / s, 1 - 1 / s) : Infinity
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const { k, s } = this.p
    if (s <= 2) return Infinity
    const m1 = (k / s) * beta((k + 1) / s, 1 - 1 / s)
    const m2 = (k / s) * beta((k + 2) / s, 1 - 2 / s)
    return m2 - m1 * m1
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const { k, s } = this.p
    if (s <= 3) return Infinity
    const m1 = (k / s) * beta((k + 1) / s, 1 - 1 / s)
    const m2 = (k / s) * beta((k + 2) / s, 1 - 2 / s)
    const m3 = (k / s) * beta((k + 3) / s, 1 - 3 / s)
    const v = m2 - m1 * m1
    return (m3 - 3 * m1 * m2 + 2 * m1 ** 3) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const { k, s } = this.p
    if (s <= 4) return Infinity
    const m1 = (k / s) * beta((k + 1) / s, 1 - 1 / s)
    const m2 = (k / s) * beta((k + 2) / s, 1 - 2 / s)
    const m3 = (k / s) * beta((k + 3) / s, 1 - 3 / s)
    const m4 = (k / s) * beta((k + 4) / s, 1 - 4 / s)
    const v = m2 - m1 * m1
    return (m4 - 4 * m1 * m3 + 6 * m1 ** 2 * m2 - 3 * m1 ** 4) / (v * v) - 3
  }

  _pdf (x) {
    return this.p.k * Math.pow(x, this.p.k - 1) / Math.pow(1 + Math.pow(x, this.p.s), 1 + this.p.k / this.p.s)
  }

  _cdf (x) {
    return Math.pow(1 + Math.pow(x, -this.p.s), -this.p.k / this.p.s)
  }

  _q (p) {
    return Math.pow(Math.pow(p, -this.p.s / this.p.k) - 1, -1 / this.p.s)
  }

  static _fitInit (data) {
    // y = x/(1+x) compresses (0,∞) to (0,1); Beta MOM on y gives (k,s) concentration estimates
    const n = data.length
    const y = data.map(x => x / (1 + x))
    const mean = y.reduce((s, x) => s + x, 0) / n
    const variance = y.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1e-4
    const factor = Math.max(mean * (1 - mean) / variance - 1, 0.1)
    return [mean * factor, (1 - mean) * factor]
  }
}
