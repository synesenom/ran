import chandrupatla from '../algorithms/chandrupatla'
import Distribution from './_distribution'

/**
 * Probability density function for the [raised cosine distribution]{@link https://en.wikipedia.org/wiki/Raised_cosine_distribution}:
 *
 * $f(x; \mu, s) = \frac{1}{2s} \Big\[1 + \cos\Big(\frac{x - \mu}{s} \pi\Big)\Big\],$
 *
 * where $\mu \in \mathbb{R}$ and $s > 0$. Support: $x \in \[\mu - s, \mu + s\]$.
 *
 * @class RaisedCosine
 * @memberof ran.dist
 * @constructor
 */
export default class RaisedCosine extends Distribution {
  /**
   * @param {number} mu Location paramter.
   * @param {number} s Scale parameter.
   */
  constructor (mu, s) {
    super('continuous', 2)

    // Validate parameters
    this.p = { mu, s }
    Distribution.validate({ mu, s }, [
      's > 0'
    ])

    // Set support
    this.s = [{
      value: mu - s,
      closed: true
    }, {
      value: mu + s,
      closed: true
    }]
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return this.p.mu
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    return this.p.s * this.p.s * (1 / 3 - 2 / (Math.PI * Math.PI))
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    return 0
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const pi2 = Math.PI * Math.PI
    return 6 * (90 - pi2 * pi2) / (5 * (pi2 - 6) * (pi2 - 6))
  }

  _generator () {
    const u = this.r.next()
    // Bracket the quantile within the standardised support [-1, 1]; chandrupatla is stable
    // where Newton diverges near the zero-derivative boundary at z = ±1.
    const z = chandrupatla(z => 0.5 * (1 + z + Math.sin(Math.PI * z) / Math.PI) - u, -1, 1)
    return this.p.mu + this.p.s * z
  }

  _pdf (x) {
    return 0.5 * (1 + Math.cos(Math.PI * (x - this.p.mu) / this.p.s)) / this.p.s
  }

  _cdf (x) {
    const z = (x - this.p.mu) / this.p.s
    return 0.5 * (1 + z + Math.sin(Math.PI * z) / Math.PI)
  }

  static _fitInit (data) {
    // mu from sample mean (equals center for a symmetric distribution); s from support half-range: range = 2s
    const n = data.length
    const mu = data.reduce((s, x) => s + x, 0) / n
    const lo = Math.min(...data)
    const hi = Math.max(...data)
    const s = Math.max(1e-6, (hi - lo) / 2)
    return [mu, s]
  }
}
