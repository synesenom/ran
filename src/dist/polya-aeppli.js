import Distribution from './_distribution'
import { poisson } from './_core'

/**
 * Generator for the [Pólya-Aeppli distribution]{@link https://arxiv.org/abs/1406.2780}:
 *
 * $$f(k; \lambda, \theta) = \begin{cases}e^{-\lambda} &\quad\text{if $k = 0$},\\e^{-\lambda} \sum_{j = 1}^k \frac{\lambda^j}{j!} \begin{pmatrix}k - 1 \\ j - 1 \\ \end{pmatrix} \theta^{k - j} (1 - \theta)^j &\quad\text{otherwise}\\\end{cases},$$
 *
 * where \(\lambda > 0\) and \(\theta \in (0, 1)\). Support: \(k \in \mathbb{N}_0\).
 *
 * @class PolyaAeppli
 * @memberOf ran.dist
 * @param {number=} lambda Mean of the Poisson component. Default value is 1.
 * @param {number=} theta Parameter of the shifted geometric component. Default value is 0.5.
 * @constructor
 */
export default class extends Distribution {
  constructor (lambda = 1, theta = 0.5) {
    super('discrete', arguments.length)

    // Validate parameters
    this.p = { lambda, theta }
    Distribution._validate({ lambda, theta }, [
      'lambda > 0',
      'theta > 0', 'theta < 1'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // Look-up tables
    this.logPdfTable = []
    this.cdfTable = []
  }

  /**
   * Computes the log-probability mass for a specific index.
   * Source: https://arxiv.org/abs/1406.2780
   *
   * @method _logPk
   * @methodOf ran.dist.PolyaAeppli
   * @param {number} k Index to compute pmf for.
   * @returns {number} The probability mass for the specified index.
   * @private
   */
  _logPk(k) {
    if (k === 0) {
      return -this.p.lambda
    }

    if (k === 1) {
      return Math.log(this.p.lambda * (1 - this.p.theta)) - this.p.lambda
    }

    return this.logPdfTable[k - 1] + Math.log((this.p.lambda * (1 - this.p.theta) + 2 * (k - 1) * this.p.theta - this.p.theta * this.p.theta * (k - 2) * Math.exp(this.logPdfTable[k - 2] - this.logPdfTable[k - 1])) / k)
  }

  /**
   * Advances look-up tables up to a specific index.
   *
   * @method _advance
   * @methodOf ran.dist.PolyaAeppli
   * @param {number} x The index to advance look-up tables to.
   * @private
   */
  _advance (x) {
    for (let k = this.logPdfTable.length; k <= x; k++) {
      let logPdf = this._logPk(k)
      this.logPdfTable.push(logPdf)
      this.cdfTable.push((this.cdfTable[this.cdfTable.length - 1] || 0) + Math.exp(logPdf))
    }
  }

  _generator () {
    let N = poisson(this.r, this.p.lambda)
    let z = 0
    for (let i = 0; i < N; i++) {
      z += Math.floor(Math.log(this.r.next()) / Math.log(this.p.theta)) + 1
    }
    return Math.round(z)
  }

  _pdf (x) {
    // Check if we already have it in the look-up table
    if (x < this.logPdfTable.length) {
      return Math.exp(this.logPdfTable[x])
    }

    // If not, compute new values and return f(x)
    this._advance(x)
    return Math.exp(this.logPdfTable[x])
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