import { erfc, erfinv } from '../special'
import normal from './_normal'
import Distribution from './_distribution'

/**
 * Probability density function for the [Lévy distribution]{@link https://en.wikipedia.org/wiki/Lévy_distribution}:
 *
 * $f(x; \mu, c) = \sqrt{\frac{c}{2 \pi}}\frac{e^{-\frac{c}{2(x - \mu)}}}{(x - \mu)^{3/2}},$
 *
 * with $\mu \in \mathbb{R}$ and $c > 0$. Support: $x \in [\mu, \infty)$.
 *
 * Cumulative distribution function:
 *
 * $F(x; \mu, c) = \operatorname{erfc}\!\left(\sqrt{\frac{c}{2(x - \mu)}}\right)$
 *
 * @class Levy
 * @memberof ran.dist
 * @constructor
 */
export default class Levy extends Distribution {
  /**
   * @param {number} mu Location parameter.
   * @param {number} c Scale parameter.
   */
  constructor (mu, c) {
    super('continuous', 2)

    // Validate parameters
    this.p = { mu, c }
    Distribution.validate({ mu, c }, [
      'c > 0'
    ])

    // Set support
    this.s = [{
      value: mu,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling by transforming normal variate
    const y = normal(this.r, 0, 1 / Math.sqrt(this.p.c))
    return this.p.mu + 1 / (y * y)
  }

  _pdf (x) {
    const z = x - this.p.mu
    return Math.sqrt(0.5 * this.p.c / Math.PI) * Math.exp(-0.5 * this.p.c / z - 1.5 * Math.log(z))
  }

  _cdf (x) {
    return x === this.p.mu ? 0 : erfc(Math.sqrt(0.5 * this.p.c / (x - this.p.mu)))
  }

  _q (p) {
    // solutions/distribution/2026-06-02-1729-levy-quantile-erfc-exact-inverse.md
    const z = erfinv(1 - p)
    return this.p.mu + 0.5 * this.p.c / (z * z)
  }

  static _fitInit (data) {
    // μ ≈ min(data); solve Levy median formula c = 2*(median-μ)*erfinv(0.5)² for c
    // erfinv(0.5)² ≈ 0.22747
    const sorted = [...data].sort((a, b) => a - b)
    const n = sorted.length
    const mu = sorted[0]
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[(n - 1) / 2]
    return [mu, Math.max(2 * (median - mu) * 0.22747, 0.01)]
  }
}
