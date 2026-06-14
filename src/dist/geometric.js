import Distribution from './_distribution'

/**
 * Probability mass function for the [geometric distribution]{@link https://en.wikipedia.org/wiki/Geometric_distribution} (the number of
 * failures before the first success definition):
 *
 * $f(k; p) = p (1 - p)^k,$
 *
 * with $p \in (0, 1]$. Support: $k \in \{0, 1, 2, ...\}$. Note that the [discrete exponential distribution]{@link https://docs.scipy.org/doc/scipy/reference/tutorial/stats/discrete_planck.html} is also a geometric distribution with rate parameter equal to $-\ln(1 - p)$.
 *
 * @class Geometric
 * @memberof ran.dist
 * @constructor
 */
export default class Geometric extends Distribution {
  /**
   * @param {number} p Probability of success.
   */
  constructor (p) {
    super('discrete', 1)

    // Validate parameters
    this.p = { p }
    Distribution.validate({ p }, [
      'p > 0', 'p <= 1'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]
  }

  static get _fitInitIsExact () {
    // _fitInit returns the exact closed-form MLE, so fit() skips the optimizer (ADR-0016).
    return true
  }

  static _fitInit (data) {
    // MLE for p: E[X] = (1-p)/p under the failures-before-success parameterization,
    // solved for p gives 1/(1+mean).
    const mean = data.reduce((s, x) => s + x, 0) / data.length
    return [1 / (1 + mean)]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return this.p.p * Math.pow(1 - this.p.p, x)
  }

  _cdf (x) {
    return 1 - Math.pow(1 - this.p.p, x + 1)
  }

  _q (p) {
    // p=1 gives log(0)=-Infinity in denominator; the distribution degenerates to always 0.
    if (this.p.p === 1) return 0
    // ceil(x)-1 equals floor(x) for non-integer x but gives x-1 when x is exact,
    // preventing the off-by-one when CDF(k) = p exactly.
    // See solutions/testing/2026-05-20-0459-discrete-quantile-ceil-minus-one-pattern.md
    return Math.ceil(Math.log(1 - p) / Math.log(1 - this.p.p)) - 1
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return (1 - this.p.p) / this.p.p
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    return (1 - this.p.p) / (this.p.p * this.p.p)
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    // Degenerate at p=1: variance is zero so skewness is undefined.
    if (this.p.p === 1) return NaN
    return (2 - this.p.p) / Math.sqrt(1 - this.p.p)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    // Degenerate at p=1: variance is zero so kurtosis is undefined.
    if (this.p.p === 1) return NaN
    return 6 + this.p.p * this.p.p / (1 - this.p.p)
  }
}
