import Distribution from './_distribution'

/**
 * Probability mass function for the [Bernoulli distribution]{@link https://en.wikipedia.org/wiki/Bernoulli_distribution}:
 *
 * $f(k; p) = \begin{cases}p &\quad\text{if $k = 1$},\\\1 - p &\quad\text{if $k = 0$},\\\\\end{cases},$
 *
 * where $p \in \[0, 1\]$. Support: $k \in \\{0, 1\\}$.
 *
 * @class Bernoulli
 * @memberof ran.dist
 * @constructor
 */
export default class Bernoulli extends Distribution {
  /**
   * @param {number} p Probability of the outcome 1.
   */
  constructor (p) {
    super('discrete', 1)

    this.p = { p }
    this.s = [{ value: 0, closed: true }, { value: 1, closed: true }]

    Distribution.validate({ p }, [
      'p >= 0',
      'p <= 1'
    ])
  }

  static get _fitInitIsExact () {
    // _fitInit returns the exact closed-form MLE, so fit() skips the optimizer (ADR-0016).
    return true
  }

  static _fitInit (data) {
    // MLE for p is the sample mean since E[X] = p.
    const mean = data.reduce((s, x) => s + x, 0) / data.length
    return [mean]
  }

  _generator () {
    return this.r.next() < this.p.p ? 1 : 0
  }

  _pdf (x) {
    if (x === 0) return 1 - this.p.p
    if (x === 1) return this.p.p
    return 0
  }

  _cdf (x) {
    if (x < 0) return 0
    if (x < 1) return 1 - this.p.p
    return 1
  }

  _q (p) {
    return p > 1 - this.p.p ? 1 : 0
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return this.p.p
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    return this.p.p * (1 - this.p.p)
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const v = this.p.p * (1 - this.p.p)
    // Variance is zero at p=0 or p=1 (point mass); skewness is undefined.
    if (!(v > 0)) return NaN
    return (1 - 2 * this.p.p) / Math.sqrt(v)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const v = this.p.p * (1 - this.p.p)
    // Variance is zero at p=0 or p=1 (point mass); kurtosis is undefined.
    if (!(v > 0)) return NaN
    return (1 - 6 * v) / v
  }
}
