import { beta } from '../special'
import Distribution from './_distribution'

/**
 * Probability density function for the [Kumaraswamy distribution]{@link https://en.wikipedia.org/wiki/Kumaraswamy_distribution} (also
 * known as Minimax distribution):
 *
 * $f(x; a, b) = a b x^{a-1} (1 - x^a)^{b - 1},$
 *
 * with $a, b > 0$. Support: $x \in (0, 1)$.
 *
 * @class Kumaraswamy
 * @memberof ran.dist
 * @constructor
 */
export default class Kumaraswamy extends Distribution {
  /**
   * @param {number} a First shape parameter.
   * @param {number} b Second shape parameter.
   */
  constructor (a, b) {
    super('continuous', 2)

    // Validate parameters
    this.p = { a, b }
    Distribution.validate({ a, b }, [
      'a > 0',
      'b > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: 1,
      closed: true
    }]
  }

  static _fitInit (data) {
    // Beta MOM on (0,1) data gives a close-enough (a,b) starting point for Nelder-Mead
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1e-4
    const factor = Math.max(mean * (1 - mean) / variance - 1, 0.1)
    return [mean * factor, (1 - mean) * factor]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    // Handle case a < 1 and x << 1
    const a = Math.pow(x, this.p.a - 1)
    if (!Number.isFinite(a)) {
      return 0
    }

    // Handle case b < 1 and 1 - x << 1
    const b = Math.pow(1 - a * x, this.p.b - 1)
    if (!Number.isFinite(b)) {
      return 0
    }
    return this.p.a * this.p.b * a * b
  }

  _cdf (x) {
    return 1 - Math.pow(1 - Math.pow(x, this.p.a), this.p.b)
  }

  _q (p) {
    return Math.pow(1 - Math.pow(1 - p, 1 / this.p.b), 1 / this.p.a)
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    const { a, b } = this.p
    return b * beta(1 + 1 / a, b)
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const { a, b } = this.p
    const m1 = b * beta(1 + 1 / a, b)
    const m2 = b * beta(1 + 2 / a, b)
    return m2 - m1 * m1
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const { a, b } = this.p
    const m1 = b * beta(1 + 1 / a, b)
    const m2 = b * beta(1 + 2 / a, b)
    const m3 = b * beta(1 + 3 / a, b)
    const mu2 = m2 - m1 * m1
    const mu3 = m3 - 3 * m2 * m1 + 2 * m1 ** 3
    return mu3 / Math.pow(mu2, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const { a, b } = this.p
    const m1 = b * beta(1 + 1 / a, b)
    const m2 = b * beta(1 + 2 / a, b)
    const m3 = b * beta(1 + 3 / a, b)
    const m4 = b * beta(1 + 4 / a, b)
    const mu2 = m2 - m1 * m1
    const mu4 = m4 - 4 * m3 * m1 + 6 * m2 * m1 ** 2 - 3 * m1 ** 4
    return mu4 / (mu2 * mu2) - 3
  }
}
