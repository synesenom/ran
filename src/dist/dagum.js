import { beta } from '../special'
import Distribution from './_distribution'

/**
 * Probability density function for the [Dagum distribution]{@link https://en.wikipedia.org/wiki/Dagum_distribution}:
 *
 * $f(x; p, a, b) = \frac{ap}{x} \frac{\big(\frac{x}{b}\big)^{ap}}{\Big\[\big(\frac{x}{b}\big)^a + 1\Big\]^{p + 1}},$
 *
 * with $p, a, b > 0$. Support: $x > 0$.
 *
 * @class Dagum
 * @memberof ran.dist
 * @constructor
 */
export default class Dagum extends Distribution {
  /**
   * @param {number} p First shape parameter.
   * @param {number} a Second shape parameter.
   * @param {number} b Scale parameter.
   */
  constructor (p, a, b) {
    super('continuous', 3)

    // Validate parameters
    // Index signature allows subclasses (e.g. Mielke) to override this.p with different parameter names
    /** @type {Object.<string, number>} */
    this.p = { p, a, b }
    Distribution.validate({ p, a, b }, [
      'p > 0',
      'a > 0',
      'b > 0'
    ])

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
    const { p, a, b } = this.p
    return a > 1 ? b * p * beta(p + 1 / a, 1 - 1 / a) : Infinity
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const { p, a, b } = this.p
    if (a <= 2) return Infinity
    const m1 = b * p * beta(p + 1 / a, 1 - 1 / a)
    const m2 = b * b * p * beta(p + 2 / a, 1 - 2 / a)
    return m2 - m1 * m1
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const { p, a, b } = this.p
    if (a <= 3) return Infinity
    const m1 = b * p * beta(p + 1 / a, 1 - 1 / a)
    const m2 = b * b * p * beta(p + 2 / a, 1 - 2 / a)
    const m3 = b ** 3 * p * beta(p + 3 / a, 1 - 3 / a)
    const v = m2 - m1 * m1
    return (m3 - 3 * m1 * m2 + 2 * m1 ** 3) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const { p, a, b } = this.p
    if (a <= 4) return Infinity
    const m1 = b * p * beta(p + 1 / a, 1 - 1 / a)
    const m2 = b * b * p * beta(p + 2 / a, 1 - 2 / a)
    const m3 = b ** 3 * p * beta(p + 3 / a, 1 - 3 / a)
    const m4 = b ** 4 * p * beta(p + 4 / a, 1 - 4 / a)
    const v = m2 - m1 * m1
    return (m4 - 4 * m1 * m3 + 6 * m1 ** 2 * m2 - 3 * m1 ** 4) / (v * v) - 3
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const y = Math.pow(x / this.p.b, this.p.a)
    return this.p.a * this.p.p * Math.pow(y, this.p.p) / (x * Math.pow(y + 1, this.p.p + 1))
  }

  _cdf (x) {
    return Math.pow(1 + Math.pow(x / this.p.b, -this.p.a), -this.p.p)
  }

  _q (p) {
    return this.p.b * Math.pow(Math.pow(p, -1 / this.p.p) - 1, -1 / this.p.a)
  }

  static _fitInit (data) {
    // Geometric mean seeds scale b; log-logistic approximation for shape a (p=1 special case is log-logistic); p seeded at 1
    const n = data.length
    const logData = data.map(x => Math.log(x))
    const meanLog = logData.reduce((s, x) => s + x, 0) / n
    const varLog = Math.max(logData.reduce((s, x) => s + (x - meanLog) ** 2, 0) / n, 1e-9)
    const b = Math.exp(meanLog)
    const a = Math.max(Math.PI / Math.sqrt(3 * varLog), 0.1)
    return [1, a, b]
  }
}
