import logGamma from '../special/log-gamma'
import { gamma, poisson } from './_core'
import Distribution from './_distribution'

/**
 * Generator for the [Delaporte distribution]{@link }:
 *
 * $$f(k; \alpha, \beta, \lambda) = \frac{e^{-\lambda}}{\Gamma(\alpha)}\sum_{j = 0}^k \frac{\Gamma(\alpha + j) \beta^j \lambda^{k - j}}{j! (1 + \beta)^{\alpha + j} (k - j)!},$$
 *
 * with \(\alpha, \beta, \lambda > 0\). Support: \(k \in \mathbb{N}_0\). For \(\lambda = 0\), it is the [negative binomial]{@link #dist.NegativeBinomial}, and for \(\alpha = \beta = 0\) it is the [Poisson distribution]{@link #dist.Poisson}. Note that these special cases are not covered by this class. For these distributions, please refer to the corresponding generators.
 *
 * @class Delaporte
 * @memberOf ran.dist
 * @param {number=} alpha Shape parameter of the gamma component. Default component is 1.
 * @param {number=} beta Scale parameter of the gamma component. Default value is 1.
 * @param {number=} lambda Mean of the Poisson component. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (alpha = 1, beta = 1, lambda = 1) {
    super('discrete', arguments.length)

    // Validate parameters
    this.p = { alpha, beta, lambda }
    Distribution._validate({ alpha, beta, lambda }, [
      'alpha > 0',
      'beta > 0',
      'lambda > 0'
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
      beta / (lambda * (1 + beta)),
      Math.exp(-lambda) / Math.pow(1 + beta, alpha)
    ]

    // Look-up tables
    this.pdfTable = []
    this.cdfTable = []
  }

  /**
   * Computes the probability mass for a specific index.
   *
   * @method _pk
   * @methodOf ran.dist.Delaporte
   * @param {number} k Index to compute pmf for.
   * @returns {number} The probability mass for the specified index.
   * @private
   */
   _pk(k) {
    // Set i = 0 term
    let ki = k
    let dz = 1
    let z = dz

    // Advance until k - 1
    for (let i = 1; i < k; i++) {
      dz *= (this.p.alpha + i - 1) * this.c[0] * ki / i
      ki--
      z += dz
    }

    // If k > 0, add last term
    if (k > 0) {
      dz *= (this.p.alpha + k - 1) * this.c[0] / k
      z += dz
    }

    // Return sum with constants
    return z * Math.exp(k * Math.log(this.p.lambda) - logGamma(k + 1)) * this.c[1]
  }

  /**
   * Advances look-up tables up to a specific index.
   *
   * @method _advance
   * @methodOf ran.dist.Delaporte
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
    let j = gamma(this.r, this.p.alpha, 1 / this.p.beta)
    return poisson(this.r, this.p.lambda + j)
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
