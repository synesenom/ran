import Dagum from './dagum'
import Distribution from './_distribution'

/**
 * Probability density function for the [Mielke distribution]{@link https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.mielke.html#r7049b665a02e-2}:
 *
 * $f(x; k, s) = \frac{k x^{k - 1}}{(1 + x^s)^{1 + k/s}},$
 *
 * with $k, s > 0$. Support: $x > 0$. It can be viewed as a re-parametrization of the [Dagum distribution]{@link #dist.Dagum}.
 *
 * @class Mielke
 * @memberof ran.dist
 * @constructor
 */
export default class Mielke extends Dagum {
  /**
   * @param {number} k First shape parameter.
   * @param {number} s Second shape parameter.
   */
  constructor (k, s) {
    super(k / s, s, 1)

    // Validate parameters
    Distribution.validate({ k, s }, [
      'k > 0',
      's > 0'
    ])

    // Dagum's constructor sets this.p = {p, a, b}; override with Mielke's own names
    this.p = { k, s }

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _pdf (x) {
    return this.p.k * Math.pow(x, this.p.k - 1) / Math.pow(1 + Math.pow(x, this.p.s), 1 + this.p.k / this.p.s)
  }

  _cdf (x) {
    return Math.pow(1 + Math.pow(x, -this.p.s), -this.p.k / this.p.s)
  }

  _q (p) {
    return Math.pow(Math.pow(p, -this.p.s / this.p.k) - 1, -1 / this.p.s)
  }

  static _fitInit (data) {
    // y = x/(1+x) compresses (0,∞) to (0,1); Beta MOM on y gives (k,s) concentration estimates
    const n = data.length
    const y = data.map(x => x / (1 + x))
    const mean = y.reduce((s, x) => s + x, 0) / n
    const variance = y.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1e-4
    const factor = Math.max(mean * (1 - mean) / variance - 1, 0.1)
    return [mean * factor, (1 - mean) * factor]
  }
}
