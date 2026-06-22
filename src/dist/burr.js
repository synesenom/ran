import { beta } from '../special'
import Distribution from './_distribution'

/**
 * Probability density function for the [Burr (XII) distribution]{@link https://en.wikipedia.org/wiki/Burr_distribution} (also known as
 * Singh-Maddala distribution):
 *
 * $f(x; c, k) = c k \frac{x^{c - 1}}{(1 + x^c)^{k + 1}},$
 *
 * with $c, k > 0$. Support: $x > 0$.
 *
 * @class Burr
 * @memberof ran.dist
 * @constructor
 */
export default class Burr extends Distribution {
  /**
   * @param {number} c First shape parameter.
   * @param {number} k Second shape parameter.
   */
  constructor (c, k) {
    super('continuous', 2)

    // Validate parameters
    this.p = { c, k }
    Distribution.validate({ c, k }, [
      'c > 0',
      'k > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    this.c = {
      ck: c * k,
      negInvK: -1 / k,
      invC: 1 / c
    }
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    const { c, k } = this.p
    return c * k > 1 ? k * beta(k - 1 / c, 1 + 1 / c) : Infinity
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const { c, k } = this.p
    if (c * k <= 2) return Infinity
    const m1 = k * beta(k - 1 / c, 1 + 1 / c)
    const m2 = k * beta(k - 2 / c, 1 + 2 / c)
    return m2 - m1 * m1
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const { c, k } = this.p
    if (c * k <= 3) return Infinity
    const m1 = k * beta(k - 1 / c, 1 + 1 / c)
    const m2 = k * beta(k - 2 / c, 1 + 2 / c)
    const m3 = k * beta(k - 3 / c, 1 + 3 / c)
    const v = m2 - m1 * m1
    return (m3 - 3 * m1 * m2 + 2 * m1 ** 3) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const { c, k } = this.p
    if (c * k <= 4) return Infinity
    const m1 = k * beta(k - 1 / c, 1 + 1 / c)
    const m2 = k * beta(k - 2 / c, 1 + 2 / c)
    const m3 = k * beta(k - 3 / c, 1 + 3 / c)
    const m4 = k * beta(k - 4 / c, 1 + 4 / c)
    const v = m2 - m1 * m1
    return (m4 - 4 * m1 * m3 + 6 * m1 ** 2 * m2 - 3 * m1 ** 4) / (v * v) - 3
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const y = Math.pow(x, this.p.c)
    return this.c.ck * y / (x * Math.pow(1 + y, this.p.k + 1))
  }

  _cdf (x) {
    // -expm1(-k * log1p(x^c)) avoids cancellation when x^c is near 0
    return -Math.expm1(-this.p.k * Math.log1p(Math.pow(x, this.p.c)))
  }

  _q (p) {
    return Math.pow(Math.pow(1 - p, this.c.negInvK) - 1, this.c.invC)
  }

  static _fitInit (data) {
    // log-scale variance gives c via log-logistic approximation; E[log(1+x^c)]=1/k (Exp identity) gives k
    const n = data.length
    const logData = data.map(x => Math.log(x))
    const meanLog = logData.reduce((s, x) => s + x, 0) / n
    const varLog = Math.max(logData.reduce((s, x) => s + (x - meanLog) ** 2, 0) / n, 1e-9)
    const c = Math.max(Math.PI / Math.sqrt(3 * varLog), 0.1)
    const k = Math.max(n / Math.max(data.reduce((s, x) => s + Math.log1p(Math.pow(x, c)), 0), 1e-9), 0.1)
    return [c, k]
  }
}
