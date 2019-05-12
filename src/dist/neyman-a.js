import { poisson } from './_core'
import Distribution from './_distribution'

/**
 * Generator for the [Neyman type A distribution]{@link http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.527.574&rep=rep1&type=pdf}:
 *
 *$$f(k; \lambda, \theta) = e^{-\lambda + \lambda e^{-\theta}},$$
 *
 * where \(\lambda, \theta > 0\). Support: \(k \in \mathbb{N}_0\0.
 *
 * @class NeymanA
 * @memberOf ran.dist
 * @param {number=} lambda Mean of the number of clusters. Default value is 1.
 * @param {number=} theta Mean of the cluster size. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (lambda = 1, theta = 1) {
    super('discrete', arguments.length)

    // Validate parameters
    this.p = { lambda, theta }
    Distribution._validate({ lambda, theta }, [
      'lambda > 0',
      'theta > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // TODO Speed-up constants

    // Look-up tables
    this.pdfTable = []
    this.cdfTable = []
  }

  /**
   * Computes the probability mass for a specific index.
   * Source: http://www1.maths.leeds.ac.uk/~sta6ajb/math2740/lecture03.pdf
   *
   * @method _pk
   * @methodOf ran.dist.NeymanA
   * @param {number} k Index to compute pmf for.
   * @returns {number} The probability mass for the specified index.
   * @private
   */
  // TODO Use some recursion instead
  _pk(k) {
    if (k === 0) {
      return Math.exp(-this.p.lambda * (1 - Math.exp(-this.p.theta)))
    }

    let dz = 1
    let z = this.pdfTable[k - 1]
    for (let j = 1; j < k; j++) {
      dz *= this.p.theta / j
      z += dz * this.pdfTable[k - j - 1]
    }
    return this.p.lambda * this.p.theta * Math.exp(-this.p.theta) * z / k
  }

  /**
   * Advances look-up tables up to a specific index.
   *
   * @method _advance
   * @methodOf ran.dist.NeymanA
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
    let N = poisson(this.r, this.p.lambda)
    let z = 0
    for (let i = 0; i < N; i++) {
      z += poisson(this.r, this.p.theta)
    }
    return Math.round(z)
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