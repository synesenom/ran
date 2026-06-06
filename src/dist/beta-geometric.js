import { logBeta } from '../special'
import Distribution from './_distribution'
import rBeta from './_beta'

/**
 * Probability mass function for the [beta-geometric distribution]{@link https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/bgepdf.htm}:
 *
 * $$f(k; \alpha, \beta) = \frac{\mathrm{B}(\alpha + 1, \beta + k - 1)}{\mathrm{B}(\alpha, \beta)},$$
 *
 * with $\alpha, \beta > 0$. Support: $k \in \{1, 2, 3, \ldots\}$.
 *
 * @class BetaGeometric
 * @memberof ran.dist
 * @param {number} alpha First shape parameter.
 * @param {number} beta Second shape parameter.
 * @constructor
 */
export default class BetaGeometric extends Distribution {
  /**
   * @param {number} alpha First shape parameter.
   * @param {number} beta Second shape parameter.
   */
  constructor (alpha, beta) {
    super('discrete', 2)

    this.p = { alpha, beta }
    Distribution.validate({ alpha, beta }, [
      'alpha > 0',
      'beta > 0'
    ])

    this.s = [{
      value: 1,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    this.c = { logBetaNorm: logBeta(alpha, beta) }
  }

  _pdf (x) {
    return x < 1 ? 0 : Math.exp(logBeta(this.p.alpha + 1, this.p.beta + x - 1) - this.c.logBetaNorm)
  }

  // CDF derived via telescoping: B(α+1,β+k-1) = B(α,β+k-1) - B(α,β+k), so F(k) = 1 - B(α,β+k)/B(α,β)
  // expm1 avoids cancellation when B(α,β+x)/B(α,β) ≈ 1 — see solutions/distribution/2026-06-06-1221-beta-geometric-telescoping-cdf.md
  _cdf (x) {
    return x < 1 ? 0 : -Math.expm1(logBeta(this.p.alpha, this.p.beta + x) - this.c.logBetaNorm)
  }

  _generator () {
    const p = rBeta(this.r, this.p.alpha, this.p.beta)
    return Math.floor(Math.log(1 - this.r.next()) / Math.log(1 - p)) + 1
  }
}
