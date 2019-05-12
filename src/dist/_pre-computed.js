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

  _pk() {
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
      let pdf = this._pk(k)
      this.pdfTable.push(pdf)
      this.cdfTable.push((this.cdfTable[this.cdfTable.length - 1] || 0) + (this.logP ? Math.exp(pdf) : pdf))
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
    return this.cdfTable[x]
  }
}