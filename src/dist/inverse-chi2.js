import { gammaUpperIncomplete, logGamma } from '../special'
import chi2 from './_chi2'
import Distribution from './_distribution'

/**
 * Probability density function for the [inverse $\chi^2$ distribution]{@link https://en.wikipedia.org/wiki/Inverse-chi-squared_distribution}:
 *
 * $f(x; \nu) = \frac{2^{-\nu/2}}{\Gamma(\nu / 2)} x^{-\nu/2 - 1} e^{-1/(2x)},$
 *
 * with $\nu \in \mathbb{N}^+$. Support: $x > 0$.
 *
 * @class InverseChi2
 * @memberof ran.dist
 * @constructor
 */
export default class InverseChi2 extends Distribution {
  /**
   * @param {number} nu Degrees of freedom.
   */
  constructor (nu) {
    super('continuous', 1)

    // Validate parameters
    const nui = Math.round(nu)
    this.p = { nu: nui }
    Distribution.validate({ nu: nui }, [
      'nu > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling
    return 1 / chi2(this.r, this.p.nu)
  }

  _pdf (x) {
    return Math.pow(2, -this.p.nu / 2) * Math.pow(x, -this.p.nu / 2 - 1) * Math.exp(-0.5 / x - logGamma(this.p.nu / 2))
  }

  _cdf (x) {
    // Complementary form avoids catastrophic cancellation in the lower tail:
    // for small x, 0.5/x is large and 1 - P(s, 0.5/x) rounds to 0.
    // See solutions/correctness/2026-05-18-1133-inverse-chi2-cdf-complementary-gamma.md
    return gammaUpperIncomplete(this.p.nu / 2, 0.5 / x)
  }

  static _fitInit (data) {
    // E[X] = 1/(ν−2) for ν > 2, so ν ≈ 2 + 1/mean; floor mean to avoid Infinity from near-zero mean
    const mean = data.reduce((s, x) => s + x, 0) / data.length
    return [Math.max(3, Math.round(2 + 1 / Math.max(mean, 1e-6)))]
  }
}
