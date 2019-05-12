import logGamma from '../special/log-gamma'
import { poisson } from './_core'
import Distribution from './_distribution'

/**
 * Generator for the [generalized Hermite distribution]{@link https://en.wikipedia.org/wiki/Hermite_distribution}:
 *
 * $$f(k; a_1, a_m, m) = p_0 \frac{\mu^k (m - d)^k}{(m - 1)^k} \sum_{j = 0}^{\lfloor k / m \rfloor} \frac{(d - 1)^j (m - 1)^{(m - 1)j}}{m^j \mu^{(m - 1)j} (m - d)^{mj} (k - mj)! j!},$$
 *
 * where \(p_0 = e^{\mu \big[\frac{d - 1}{m} - 1\big]}\), \(m\mu = a_1 + m a_m\), \(d = \frac{a_1 + m^2 a_m}{a_1 + m a_m}\), \(a_1, a_m > 0\) and \(m \in \mathbb{N}^+ \ \{1\}\). Support: \(k \in \mathbb{N}\). It is the distribution of \(X_1 + m X_m\) where \(X_1, X_2\) are Poisson variates with parameters \(a_1, a_m\) respectively. This implementation uses the recursive method described in [1].
 *
 * @class GeneralizedHermite
 * @memberOf ran.dist
 * @param {number=} a1 Mean of the first Poisson component. Default value is 1.
 * @param {number=} am Mean of the second Poisson component. Default value is 1.
 * @param {number=} m Multiplier of the second Poisson. If not an integer, it is rounded to the nearest one. Default value is 2.
 * @constructor
 */
export default class extends Distribution {
  constructor (a1 = 1, a2 = 1, m = 2) {
    super('discrete', arguments.length)

    // Validate parameters
    let mi = Math.round(m)
    this.p = { a1, a2, m: mi }
    Distribution._validate({ a1, a2, m: mi }, [
      'a1 > 0',
      'a2 > 0',
      'm > 1'
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
    this.c = [
      a1 + m * a2,
      (a1 + m * m * a2) / (a1 + m * a2),
      Math.exp(-a1 - a2)
    ]

    // Look-up tables
    this.pdfTable = []
    this.cdfTable = []
  }

  /**
   * Computes the probability mass for a specific index.
   * Source: https://journal.r-project.org/archive/2015/RJ-2015-035/RJ-2015-035.pdf
   *
   * @method _pk
   * @methodOf ran.dist.GeneralizedHermite
   * @param {number} k Index to compute pmf for.
   * @returns {number} The probability mass for the specified index.
   * @private
   */
  _pk (k) {
    if (k === 0) {
      return this.c[2]
    }

    if (k < this.p.m) {
      return this.c[2] * Math.exp(k * Math.log(this.c[0]) - logGamma(k + 1) + k * Math.log((this.p.m - this.c[1]) / (this.p.m - 1)))
    }

    return this.c[0] * ((this.c[1] - 1) * this.pdfTable[k - this.p.m] + (this.p.m - this.c[1]) * this.pdfTable[k - 1]) / (k * (this.p.m - 1))
  }

  /**
   * Advances look-up tables up to a specific index.
   *
   * @method _advance
   * @methodOf ran.dist.GeneralizedHermite
   * @param {number} x The index to advance look-up tables to.
   * @private
   */
  _advance (x) {
    for (let k = this.pdfTable.length; k <= x; k++) {
      let pdf = this._pk(k)
      this.pdfTable.push(pdf)
      this.cdfTable.push((this.cdfTable[this.cdfTable.length - 1] || 0) + pdf)
    }
  }

  _generator () {
    return poisson(this.r, this.p.a1) + this.p.m * poisson(this.r, this.p.a2)
  }

  _pdf (x) {
    // Check if we already have it in the look-up table
    if (x < this.pdfTable.length) {
      return this.pdfTable[x]
    }

    // If not, compute new values and return f(x)
    this._advance(x)
    return this.pdfTable[x]
  }

  _cdf (x) {
    // If already in table, return value
    if (x < this.cdfTable.length) {
      return this.cdfTable[x]
    }

    // Otherwise, advance to current index and return F(x)
    this._advance(x)
    return this.cdfTable[x]
  }
}