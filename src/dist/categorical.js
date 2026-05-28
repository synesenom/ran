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

  static _fitInit (data) {
    // Subclasses (Bernoulli, Binomial, Zipf, ...) reuse Categorical's storage but have scalar
    // constructors of their own; only override for Categorical itself so the base-class random
    // retry still services the rest of the hierarchy.
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
   * Estimates the categorical distribution from data via maximum likelihood. The MLE is
   * closed-form (empirical frequencies of the observed integer categories) so this override
   * skips Nelder-Mead. See [decisions/0012-distribution-fit-nelder-mead.md]{@link ../../decisions/0012-distribution-fit-nelder-mead.md}.
   *
   * @method fit
   * @memberof ran.dist.Categorical
   * @param {number[]} data Array of integer observations to fit.
   * @returns {Categorical} A new Categorical instance with MLE parameters.
   */
  static fit (data) {
    // Subclasses (Bernoulli, Binomial, etc.) have scalar constructors, so the (weights, min)
    // construction here only applies to Categorical itself — delegate everything else to the
    // base-class implementation, which still wires the subclass's own _fitInit into Nelder-Mead.
    if (this !== Categorical) {
      return super.fit(data)
    }
    return new this(this._fitInit(data), Math.min(...data))
  }
}
