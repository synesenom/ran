import AliasTable from './_alias-table'
import Distribution from './_distribution'

/**
 * Generator for a [categorical distribution]{@link https://en.wikipedia.org/wiki/Categorical_distribution}:
 *
 * $$f(k; \{w\}) = \frac{w_k}{\sum_j w_j},$$
 *
 * where $w_k > 0$. Support: $k \in \mathbb{N}_0$.
 *
 * @class Categorical
 * @memberof ran.dist
 * @param {number[]=} weights Weights for the distribution (doesn't need to be normalized). Default value is an array with a single value of 1.
 * @param {number=} min Lowest value to sample (support starts at this value). Default value is [1, 1, 1].
 * @constructor
 */
export default class extends Distribution {
  constructor (weights = [1, 1, 1], min = 0) {
    super('discrete', arguments.length)

    // Validate parameters
    this.p = { n: weights.length, weights, min }
    Distribution.validate({
      w_i: (() => {
        const allPositive = weights.reduce((acc, d) => acc && (d >= 0), true)
        return allPositive ? 1 : -1
      })(),
      min
    }, [
      'w_i >= 0'
    ])

    // Set support
    this.s = [{
      value: min,
      closed: true
    }, {
      value: Math.max(0, weights.length - 1) + min,
      closed: true
    }]

    // Build alias table
    this.aliasTable = new AliasTable(weights)

    // Build pmf and cdf
    let weight = this.aliasTable.weight(0)
    this.pdfTable = [weight]
    this.cdfTable = [weight]
    for (let i = 1; i < weights.length; i++) {
      weight = this.aliasTable.weight(i)
      this.pdfTable.push(weight)
      this.cdfTable.push(this.cdfTable[i - 1] + weight)
    }
  }

  _generator () {
    // Direct sampling
    return this.p.min + this.aliasTable.sample(this.r)
  }

  _pdf (x) {
    if (this.p.n <= 1) {
      return 1
    } else {
      return this.pdfTable[x - this.p.min]
    }
  }

  _cdf (x) {
    return Math.min(1, this.cdfTable[x - this.p.min])
  }
}
