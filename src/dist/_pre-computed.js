import Distribution from './_distribution'

/**
 * Base class representing a discrete distribution with a pre-computed array of probability mass values.
 *
 * @class PreComputed
 * @memberOf ran.dist
 * @abstract
 * @private
 */
export default class extends Distribution {
  constructor (logP = false) {
    super('discrete', arguments.length)

    // Logarithmic pdf
    this.logP = logP

    // Look-up tables
    this.pdfTable = []
    this.cdfTable = []
  }

  /**
   * Computes the probability mass value for a specified index.
   *
   * @method _pk
   * @methodOf ran.dist.PreComputed
   * @param {number} k Index to computed probability for.
   * @returns {number} The probability for the specified index.
   * @private
   */
  _pk (k) {
    throw Error('_pk() is not implemented')
  }

  /**
   * Advances look-up tables up to a specific index.
   *
   * @method _advance
   * @methodOf ran.dist.PreComputed
   * @param {number} x The index to advance look-up tables to.
   * @private
   */
  _advance (x) {
    for (let k = this.pdfTable.length; k <= x; k++) {
      // Update probability mass
      let pdf = this._pk(k)
      this.pdfTable.push(pdf)

      // Update cumulative function
      if (typeof this['_ck'] === 'function') {
        this.cdfTable.push(this._ck(k))
      } else {
        this.cdfTable.push((this.cdfTable[this.cdfTable.length - 1] || 0) + (this.logP ? Math.exp(pdf) : pdf))
      }
    }
  }

  _pdf (x) {
    // Check if we already have it in the look-up table
    if (x < this.pdfTable.length) {
      return this.logP ? Math.exp(this.pdfTable[x]) : this.pdfTable[x]
    }

    // If not, compute new values and return f(x)
    this._advance(x)
    return this.logP ? Math.exp(this.pdfTable[x]) : this.pdfTable[x]
  }

  _cdf (x) {
    // If already in table, return value
    if (x < this.cdfTable.length) {
      return this.cdfTable[x]
    }

    // Otherwise, advance to current index and return F(x)
    this._advance(x)
    return Math.min(1, this.cdfTable[x])
  }
}
