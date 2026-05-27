import { lambertW0 } from '../special'
import Distribution from './_distribution'

/**
 * Probability function for the [Benktander type II distribution]{@link https://en.wikipedia.org/wiki/Benktander_type_II_distribution}:
 *
 * $f(x; a, b) = e^{\frac{a}{b}(1 - x^b)} x^{b-2} (ax^b - b + 1),$
 *
 * with $a > 0$ and $b \in (0, 1]$. Support: $x \in [1, \infty)$.
 *
 * @class BenktanderII
 * @memberof ran.dist
 * @constructor
 */
export default class BenktanderII extends Distribution {
  /**
   * @param {number} a Scale parameter.
   * @param {number} b Shape parameter.
   */
  constructor (a, b) {
    super('continuous', 2)

    // Validate parameters
    this.p = { a, b }
    Distribution.validate({ a, b }, [
      'a > 0',
      'b > 0', 'b <= 1'
    ])

    // Set support
    this.s = [{
      value: 1,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    this.c = {
      bm1OverA: (1 - b) / a,
      expNegAOverB: Math.exp(-a / b),
      bOverBm1: b / (b - 1),
      logScaled: Math.log(a / (1 - b)) + a / (1 - b),
      bIsOne: 1 - b < Number.EPSILON
    }
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    // b = 1
    if (this.c.bIsOne) {
      return this.p.a * Math.exp(this.p.a * (1 - x))
    }

    // All other cases
    const y = Math.pow(x, this.p.b)
    return Math.exp(this.p.a * (1 - y) / this.p.b) * Math.pow(x, this.p.b - 2) * (this.p.a * y - this.p.b + 1)
  }

  _cdf (x) {
    // b = 1
    if (this.c.bIsOne) {
      // expm1 avoids 1 - exp(arg) cancellation when arg → 0 near x = 1
      return -Math.expm1(this.p.a * (1 - x))
    }

    // All other cases
    // Split 1 - xbm1*exp(u) as (1 - xbm1) + xbm1*(1 - exp(u)) to avoid
    // 1 - 1 cancellation when both factors approach 1 near x = 1;
    // refVals near x=1 must use the direct formula, not this expm1 path — see
    // solutions/testing/2026-05-22-1708-refvals-self-validation-cancellation-boundary.md
    // xbm1 = xb/x reuses the already-computed xb and avoids a second Math.pow;
    // using the same xbm1 in both terms guarantees (1-xbm1)+xbm1 = 1 at large x
    // where expm1(u) collapses to -1
    const xb = Math.pow(x, this.p.b)
    const u = this.p.a * (1 - xb) / this.p.b
    const xbm1 = xb / x
    return (1 - xbm1) - xbm1 * Math.expm1(u)
  }

  _q (p) {
    // b = 1
    if (this.c.bIsOne) {
      return 1 - Math.log(1 - p) / this.p.a
    }

    // Check if b is too close to 1
    const w = lambertW0(Math.pow(this.c.expNegAOverB * (1 - p), this.c.bOverBm1) / this.c.bm1OverA)
    if (!Number.isFinite(w)) {
      // 1 - b << 1, use logarithms
      const l1 = this.c.logScaled + this.c.bOverBm1 * Math.log(1 - p)
      const l2 = Math.log(l1)

      // W(x) ~= ln(x) - ln ln(x) - ln(x) / (ln ln(x))
      return Math.pow(this.c.bm1OverA * (l1 - l2 + l2 / l1), 1 / this.p.b)
    } else {
      // All other cases
      return Math.pow(this.c.bm1OverA * w, 1 / this.p.b)
    }
  }
}
