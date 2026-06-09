import exponential from './_exponential'
import AliasTable from './_alias-table'
import Distribution from './_distribution'
import neumaier from '../algorithms/neumaier'
import powell from '../algorithms/powell'

/**
 * Probability density function for the [hyperexponential distribution]{@link https://en.wikipedia.org/wiki/Hyperexponential_distribution}:
 *
 * $f(x; \{w\}, \{\lambda\}) = \frac{1}{\sum_j w_j} \sum_i w_i \lambda_i e^{-\lambda_i x},$
 *
 * where $w_i, \lambda_i > 0$. Support: $x \ge 0$.
 *
 * @class Hyperexponential
 * @memberof ran.dist
 * object with two properties: weight and rate.
 * @constructor
 */
export default class Hyperexponential extends Distribution {
  /**
   * @param {Object[]} parameters Array containing the rates and corresponding weights. Each array element must be an
   */
  constructor (parameters) {
    super('continuous', parameters.length)

    const weights = parameters.map(d => d.weight)
    const rates = parameters.map(d => d.rate)
    Distribution.validate({
      r_min: rates.reduce((m, x) => x < m ? x : m, Infinity),
      w_min: weights.reduce((m, x) => x < m ? x : m, Infinity),
      n: weights.length
    }, [
      'r_min > 0',
      'w_min > 0',
      'n > 0'
    ])

    const norm = weights.reduce((acc, d) => d + acc, 0)
    this.p = Object.assign(this.p, {
      weights: weights.map(d => d / norm),
      rates,
      n: weights.length
    })

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // Categorical generator for weight
    this.aliasTable = new AliasTable(weights)
  }

  _generator () {
    // Direct sampling
    const i = this.aliasTable.sample(this.r)
    return exponential(this.r, this.p.rates[i])
  }

  _pdf (x) {
    return neumaier(this.p.rates.map((d, i) => this.p.weights[i] * d * Math.exp(-d * x)))
  }

  _cdf (x) {
    // -expm1(-d*x) per component avoids cancellation when d*x is near 0
    return Math.min(neumaier(this.p.rates.map((d, i) => this.p.weights[i] * -Math.expm1(-d * x))), 1)
  }

  /**
   * @returns {number} Weighted sum of reciprocal rates.
   */
  mean () {
    return neumaier(this.p.rates.map((r, i) => this.p.weights[i] / r))
  }

  /**
   * @returns {number} Second central moment of the mixture.
   */
  variance () {
    const m1 = this.mean()
    const m2 = 2 * neumaier(this.p.rates.map((r, i) => this.p.weights[i] / (r * r)))
    return m2 - m1 * m1
  }

  /**
   * @returns {number} Standardised third central moment of the mixture.
   */
  skewness () {
    const m1 = this.mean()
    const m2 = 2 * neumaier(this.p.rates.map((r, i) => this.p.weights[i] / (r * r)))
    const m3 = 6 * neumaier(this.p.rates.map((r, i) => this.p.weights[i] / (r * r * r)))
    const v = m2 - m1 * m1
    return (m3 - 3 * m1 * m2 + 2 * m1 * m1 * m1) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} Excess kurtosis of the mixture.
   */
  kurtosis () {
    const m1 = this.mean()
    const m2 = 2 * neumaier(this.p.rates.map((r, i) => this.p.weights[i] / (r * r)))
    const m3 = 6 * neumaier(this.p.rates.map((r, i) => this.p.weights[i] / (r * r * r)))
    const m4 = 24 * neumaier(this.p.rates.map((r, i) => this.p.weights[i] / (r * r * r * r)))
    const v = m2 - m1 * m1
    return (m4 - 4 * m1 * m3 + 6 * m1 * m1 * m2 - 3 * m1 * m1 * m1 * m1) / (v * v) - 3
  }

  static _fitInit (data) {
    // k=2 is the smallest non-trivial mixture and avoids over-fitting on default fit() calls; users
    // who need more components must construct the distribution manually. Splitting the sorted data
    // at the median and taking 1/mean per bucket as a rate seeds Nelder-Mead with two distinct
    // time-scales, well separated from the degenerate optimum where both rates collapse to 1/mean.
    const sorted = data.slice().sort((a, b) => a - b)
    const mid = Math.max(1, Math.floor(sorted.length / 2))
    const low = sorted.slice(0, mid)
    const high = sorted.slice(mid).length > 0 ? sorted.slice(mid) : low
    const meanLow = low.reduce((s, x) => s + x, 0) / low.length || 1
    const meanHigh = high.reduce((s, x) => s + x, 0) / high.length || meanLow
    return [0.5, 0.5, 1 / meanLow, 1 / meanHigh]
  }

  /**
   * Estimates the hyperexponential distribution from data via maximum likelihood, using a fixed
   * two-component default mixture. Overrides the base-class fit() to pack and unpack the
   * optimizer's flat vector around the (Object[]) constructor signature. See
   * [decisions/0016-distribution-fit-powell-and-exact-mle.md]{@link ../../decisions/0016-distribution-fit-powell-and-exact-mle.md}.
   *
   * @method fit
   * @memberof ran.dist.Hyperexponential
   * @param {number[]} data Array of non-negative observations to fit.
   * @returns {Hyperexponential} A new Hyperexponential instance with MLE parameters.
   */
  static fit (data) {
    // The constructor takes an Object[] of {weight, rate}, so the base-class fit() spread cannot
    // reconstruct it from the optimizer's flat numeric vector. Override to pack the optimiser's
    // [w_0..w_{k-1}, r_0..r_{k-1}] vector back into the required object-array shape on every
    // evaluation, then return the best fit.
    const Cls = this
    const x0 = Cls._fitInit(data)
    const k = x0.length / 2
    const toParams = v => {
      const params = new Array(k)
      for (let i = 0; i < k; i++) params[i] = { weight: v[i], rate: v[i + k] }
      return params
    }
    const best = powell(
      v => {
        try {
          const l = -new Cls(toParams(v)).lnL(data)
          return isNaN(l) ? Infinity : l
        } catch (_) {
          return Infinity
        }
      },
      x0
    )
    return new Cls(toParams(best))
  }
}
