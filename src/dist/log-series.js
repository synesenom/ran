import { betaIncomplete } from '../special'
import Distribution from './_distribution'

/**
 * Probability mass function for the [log-series distribution]{@link https://en.wikipedia.org/wiki/Logarithmic_distribution}:
 *
 * $f(k; p) = \frac{-1}{\ln(1 - p)}\frac{p^k}{k},$
 *
 * with $p \in (0, 1)$. Support: $k \in \mathbb{N}^+$.
 *
 * Cumulative distribution function:
 *
 * $F(k; p) = 1 + \frac{I_p(k+1, 0)}{\ln(1-p)}$
 *
 * @class LogSeries
 * @memberof ran.dist
 * @see A. Kemp, "Efficient generation of logarithmically distributed pseudo-random variables", Appl. Stat. 30(3), 249–253, 1981.
 * @constructor
 */
export default class LogSeries extends Distribution {
  /**
   * @param {number} p Distribution parameter.
   */
  constructor (p) {
    super('discrete', 1)

    // Validate parameters
    this.p = { p }
    Distribution.validate({ p }, [
      'p > 0', 'p < 1'
    ])

    // Set support
    this.s = [{
      value: 1,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]
  }

  static _fitInit (data) {
    // E[X] ≈ 1/(1-p)^2 for p near 1; inverting gives p ≈ 1 - 1/sqrt(mean).
    // See solutions/distribution/2026-05-28-1120-log-series-fitinit-asymptotic-inversion.md
    const mean = data.reduce((s, x) => s + x, 0) / data.length
    return [Math.max(0.01, Math.min(0.99, 1 - 1 / Math.sqrt(mean)))]
  }

  _generator () {
    // Direct sampling
    return Math.floor(1 + Math.log(this.r.next()) / Math.log(1 - Math.pow(1 - this.p.p, this.r.next())))
  }

  _pdf (x) {
    return -Math.pow(this.p.p, x) / (x * Math.log(1 - this.p.p))
  }

  _cdf (x) {
    return 1 + betaIncomplete(x + 1, 0, this.p.p) / Math.log(1 - this.p.p)
  }
}
