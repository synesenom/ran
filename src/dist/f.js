import Beta from './beta'
import Distribution from './_distribution'

/**
 * Probability density function for the [F distribution]{@link https://en.wikipedia.org/wiki/F-distribution} (or Fisher-Snedecor's F
 * distribution):
 *
 * $f(x; d_1, d_2) = \frac{\sqrt{\frac{(d_1 x)^{d_1} d_2^{d_2}}{(d_1x + d_2)^{d_1 + d_2}}}}{x \mathrm{B}\big(\frac{d_1}{2}, \frac{d_2}{2}\big)},$
 *
 * with $d_1, d_2 > 0$. Support: $x > 0$.
 *
 * @class F
 * @memberof ran.dist
 * @constructor
 */
export default class F extends Beta {
  // Transformation of beta distribution
  /**
   * @param {number} d1 First degree of freedom. If not an integer, it is rounded to the nearest one.
   * @param {number} d2 Second degree of freedom. If not an integer, it is rounded to the nearest one.
   */
  constructor (d1, d2) {
    const d1i = Math.round(d1)
    const d2i = Math.round(d2)
    super(d1i / 2, d2i / 2)

    // Validate parameters
    this.p = Object.assign(this.p, { d1: d1i, d2: d2i })
    Distribution.validate({ d1: d1i, d2: d2i }, [
      'd1 > 0',
      'd2 > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: d1i !== 1
    }, {
      value: Infinity,
      closed: false
    }]
  }

  // Blocks Beta's log-barrier: fit() operates in (d1, d2) space, not (alpha, beta). See decisions/0017-beta-fit-penalty.md §3.
  static _fitPenalty () { return 0 }

  static _fitInit (data) {
    // E[X] = d2/(d2−2) ⇒ d2 = 2·mean/(mean−1); d1 from Var = 2·d2²(d1+d2−2)/(d1(d2−2)²(d2−4))
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1
    const d2 = mean > 1 ? Math.max(2 * mean / (mean - 1), 4.1) : 10
    const denom = variance * (d2 - 2) ** 2 * (d2 - 4) - 2 * d2 * d2
    const d1 = denom > 0 ? Math.max(2 * d2 * d2 * (d2 - 2) / denom, 1) : 5
    return [d1, d2]
  }

  // See solutions/distribution/2026-06-03-1130-integer-param-fit-profile-grid-search.md
  /**
   * @param {number[]} data Array of sample values.
   * @returns {F} Fitted distribution.
   */
  static fit (data) {
    const Cls = this
    const [d1Hat, d2Hat] = Cls._fitInit(data)
    const d1Seed = Math.round(d1Hat)
    const d2Seed = Math.round(d2Hat)
    const w1 = Distribution._adaptiveHalfWidth(d1 => { try { return new Cls(d1, d2Seed).lnL(data) } catch (_) { return -Infinity } }, d1Seed, 1)
    const w2 = Distribution._adaptiveHalfWidth(d2 => { try { return new Cls(d1Seed, d2).lnL(data) } catch (_) { return -Infinity } }, d2Seed, 1)
    const d1Lo = Math.max(1, d1Seed - w1)
    const d1Hi = d1Seed + w1
    const d2Lo = Math.max(1, d2Seed - w2)
    const d2Hi = d2Seed + w2
    let bestD1 = d1Seed
    let bestD2 = d2Seed
    let bestLnL = -Infinity
    for (let d1 = d1Lo; d1 <= d1Hi; d1++) {
      for (let d2 = d2Lo; d2 <= d2Hi; d2++) {
        try {
          const lnL = new Cls(d1, d2).lnL(data)
          if (lnL > bestLnL) { bestLnL = lnL; bestD1 = d1; bestD2 = d2 }
        } catch (_) {}
      }
    }
    return new Cls(bestD1, bestD2)
  }

  _generator () {
    // Direct sampling by transforming beta variate
    const x = super._generator()
    return this.p.d2 * x / (this.p.d1 * (1 - x))
  }

  _pdf (x) {
    const y = this.p.d2 + this.p.d1 * x
    return this.p.d1 * this.p.d2 * super._pdf(this.p.d1 * x / y) / Math.pow(y, 2)
  }

  _cdf (x) {
    const y = this.p.d1 * x
    return super._cdf(1 / (1 + this.p.d2 / y))
  }
}
