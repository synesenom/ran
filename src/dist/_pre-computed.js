import AliasTable from './_alias-table'
import Distribution from './_distribution'

/**
 * Base class representing a discrete distribution with pre-computed arrays. This class should be used when the
 * cumulative probability function is not available in closed form. A basic adaptive alias table is also implemented for
 * the case there is no simple method to generate random variates.
 *
 * @class PreComputed
 * @memberOf ran.dist
 * @abstract
 * @private
 */
export default class extends Distribution {
  constructor (logP = false) {
    super('discrete', arguments.length)

    // Constants
    this.TABLE_SIZE = 1000
    this.MAX_NUMBER_OF_TABLES = 100

    // Logarithmic pdf
    this.logP = logP

    // Look-up tables
    this.aliasTables = []
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

  /**
   * Adds a new alias table.
   *
   * @method _addAliasTable
   * @methodOf ran.dist.PreComputed
   * @private
   */
  _addAliasTable () {
    // Calculate index offset
    let offset = this.aliasTables.length

    // Compute weights and total weight
    let weights = Array.from({ length: this.TABLE_SIZE }, (d, i) => this._pdf(this.TABLE_SIZE * offset + i))
    let total = weights.reduce((acc, d) => acc + d, 0)
    if (offset > 0) {
      // Remove previously accumulated total weight
      total += this.aliasTables[offset - 1].total
    }

    // Add table
    this.aliasTables.push({
      table: new AliasTable(weights.concat([1 - total])),
      total
    })
  }

  _generator () {
    // Start with first table
    let tableIndex = 0
    do {
      // Add table if needed
      if (tableIndex >= this.aliasTables.length) {
        this._addAliasTable()
      }

      // Sample from current table
      let i = this.aliasTables[tableIndex].table.sample(this.r)

      // Check if sample is outside of table domain
      if (i === this.TABLE_SIZE) {
        // Increment table index and add new table if needed
        tableIndex++
      } else {
        // Otherwise, return sample
        return i + tableIndex * this.TABLE_SIZE
      }
    } while (tableIndex < this.MAX_NUMBER_OF_TABLES)

    // If did not find sample in max number of tables, return undefined
    return undefined
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
