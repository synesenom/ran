import { aliasTable } from './_core'
import Distribution from './_distribution'

/**
 * Generator for a [categorical distribution]{@link https://en.wikipedia.org/wiki/Categorical_distribution}:
 *
 * $$f(k; \{w\}) = \frac{w_k}{\sum_j w_j},$$
 *
 * where \(w_k > 0 / \{0\}\). Support: \(k \in \mathbb{N}_0\).
 *
 * @class Categorical
 * @memberOf ran.dist
 * @param {number[]=} weights Weights for the distribution (doesn't need to be normalized). Default value is an array with a single value of 1.
 * @param {number=} min Lowest value to sample (support starts at this value). Default value is 0.
 * @constructor
 */
export default class extends Distribution {
  constructor (weights = [1], min = 0) {
    super('discrete', arguments.length)

    // Validate parameters
    this.p = { n: weights.length, weights, min }
    Distribution._validate({ w_i: weights.reduce((acc, d) => acc * d, 1), min }, [
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

    // Pre-compute tables
    let { prob, alias, normalizedWeights } = aliasTable(weights)

    // Build pmf and cdf
    let pmf = [normalizedWeights[0]]

    let cdf = [normalizedWeights[0]]
    for (let i = 1; i < weights.length; i++) {
      pmf.push(normalizedWeights[i])
      cdf.push(cdf[i - 1] + normalizedWeights[i])
    }

    // Assign to constants
    this.c = [prob, alias, pmf, cdf]
  }

  _generator () {
    // Direct sampling
    if (this.p.n <= 1) {
      return this.p.min
    }
    let i = Math.floor(this.r.next() * this.p.n)
    if (this.r.next() < this.c[0][i]) {
      return i + this.p.min
    } else {
      return this.c[1][i] + this.p.min
    }
  }

  _pdf (x) {
    if (this.p.n <= 1) {
      return 1
    } else {
      return this.c[2][x - this.p.min]
    }
  }

  _cdf (x) {
    return Math.min(1, this.c[3][x - this.p.min])
  }
}
