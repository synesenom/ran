import Distribution from './_distribution'

/**
 * Probability mass function for the [discrete Weibull distribution]{@link https://en.wikipedia.org/wiki/Discrete_Weibull_distribution} (using the original parametrization):
 *
 * $f(k; q, \beta) = q^{k^\beta} - q^{(k + 1)^\beta},$
 *
 * with $q \in (0, 1)$ and $\beta > 0$. Support: $k \in \mathbb{N}_0$.
 *
 * @class DiscreteWeibull
 * @memberof ran.dist
 * @constructor
 */
export default class DiscreteWeibull extends Distribution {
  /**
   * @param {number} q First shape parameter.
   * @param {number} beta Second shape parameter.
   */
  constructor (q, beta) {
    super('discrete', 2)

    // Validate parameters
    this.p = { q, beta }
    Distribution.validate({ q, beta }, [
      'q > 0', 'q < 1',
      'beta > 0'
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

  static _fitInit (data) {
    // PMF(0) = 1-q, so q ≈ fraction of nonzero observations; beta = 1 as neutral shape seed.
    const zeroFraction = data.filter(x => x === 0).length / data.length
    return [Math.max(0.01, Math.min(0.99, 1 - zeroFraction)), 1]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return Math.pow(this.p.q, Math.pow(x, this.p.beta)) - Math.pow(this.p.q, Math.pow(x + 1, this.p.beta))
  }

  _cdf (x) {
    return 1 - Math.pow(this.p.q, Math.pow(x + 1, this.p.beta))
  }

  _q (p) {
    // ceil(x)-1 equals floor(x) for non-integer x but gives x-1 when x is exact,
    // preventing the off-by-one when CDF(k) = p exactly.
    return Math.ceil(Math.pow(Math.log(1 - p) / Math.log(this.p.q), 1 / this.p.beta)) - 1
  }

  // No closed-form moments exist for arbitrary β: the survival-sum identity
  // E[X^n] = Σ S(k) reduces to a generalized polylogarithm in q^{k^β} for which
  // no elementary closed form is known. The base-class numerical fallback (#403) is used.
}
