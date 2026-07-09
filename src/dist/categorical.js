import AliasTable from './_alias-table'
import Distribution from './_distribution'

/**
 * Generator for a [categorical distribution]{@link https://en.wikipedia.org/wiki/Categorical_distribution}:
 *
 * $f(k; \{w\}) = \frac{w_k}{\sum_j w_j},$
 *
 * where $w_k > 0$. Support: $k \in \mathbb{N}_0$.
 *
 * @class Categorical
 * @memberof ran.dist
 * @constructor
 */
export default class Categorical extends Distribution {
  /**
   * @param {number[]} weights Weights for the distribution (doesn't need to be normalized).
   * @param {number} min Lowest value to sample (support starts at this value).
   */
  constructor (weights, min) {
    super('discrete', 2)

    // decisions/0014-categorical-this-c-natural-params-split.md — n and min are lookup state, not natural parameters
    this.c = { n: weights.length, min }
    /** @type {Object} */
    this.p = { weights }
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

    // Store normalized weights in this.c so they survive a save()/load() round-trip.
    // Subclasses overwrite this.p, so this.c is the only stable serialized home for the table.
    this.c.pdfTable = this.pdfTable
  }

  _afterLoad () {
    this.aliasTable = new AliasTable(this.c.pdfTable)
    this.pdfTable = this.c.pdfTable
    this.cdfTable = [this.pdfTable[0]]
    for (let i = 1; i < this.pdfTable.length; i++) {
      this.cdfTable.push(this.cdfTable[i - 1] + this.pdfTable[i])
    }
  }

  _generator () {
    // Direct sampling
    return this.c.min + this.aliasTable.sample(this.r)
  }

  _pdf (x) {
    if (this.c.n <= 1) {
      return 1
    } else {
      return this.pdfTable[x - this.c.min]
    }
  }

  _cdf (x) {
    return Math.min(1, this.cdfTable[x - this.c.min])
  }

  static _fitInit (data) {
    // Subclasses (Zipf, ...) that still extend Categorical have scalar constructors of their own;
    // only override for Categorical itself so the base-class random retry still services the rest.
    if (this !== Categorical) {
      return super._fitInit(data)
    }
    // Empirical frequencies are the unconstrained MLE for the categorical PMF, so this hook
    // returns the closed-form optimum itself; fit() below skips Nelder-Mead because there is
    // nothing left to optimise.
    const min = Math.min(...data)
    const max = Math.max(...data)
    const counts = new Array(max - min + 1).fill(0)
    for (const x of data) counts[x - min]++
    return counts.map(c => c / data.length)
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    const { min, n } = this.c
    let m = 0
    for (let i = 0; i < n; i++) {
      m += (min + i) * this.pdfTable[i]
    }
    return m
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const { min, n } = this.c
    let m1 = 0; let m2 = 0
    for (let i = 0; i < n; i++) {
      const x = min + i
      const p = this.pdfTable[i]
      m1 += x * p
      m2 += x * x * p
    }
    return m2 - m1 * m1
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const { min, n } = this.c
    let m1 = 0; let m2 = 0; let m3 = 0
    for (let i = 0; i < n; i++) {
      const x = min + i
      const p = this.pdfTable[i]
      m1 += x * p
      m2 += x * x * p
      m3 += x * x * x * p
    }
    const v = m2 - m1 * m1
    if (!(v > 0)) return NaN
    return (m3 - 3 * m1 * m2 + 2 * m1 * m1 * m1) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const { min, n } = this.c
    let m1 = 0; let m2 = 0; let m3 = 0; let m4 = 0
    for (let i = 0; i < n; i++) {
      const x = min + i
      const p = this.pdfTable[i]
      m1 += x * p
      m2 += x * x * p
      m3 += x * x * x * p
      m4 += x * x * x * x * p
    }
    const v = m2 - m1 * m1
    if (!(v > 0)) return NaN
    return (m4 - 4 * m1 * m3 + 6 * m1 * m1 * m2 - 3 * m1 * m1 * m1 * m1) / (v * v) - 3
  }

  /** @inheritdoc */
  static fit (data) {
    // Subclasses that still extend Categorical have scalar constructors, so the (weights, min)
    // construction here only applies to Categorical itself — delegate everything else to the
    // base-class implementation, which still wires the subclass's own _fitInit into Nelder-Mead.
    if (this !== Categorical) {
      return super.fit(data)
    }
    return new this(this._fitInit(data), Math.min(...data))
  }
}
