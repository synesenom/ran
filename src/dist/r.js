import Beta from './beta'
import Distribution from './_distribution'

/**
 * Probability density function for the [R distribution]{@link https://docs.scipy.org/doc/scipy-1.5.4/reference/tutorial/stats/continuous_rdist.html}:
 *
 * $f(x; c) = \frac{(1 - x^2)^{\frac{c}{2} - 1}}{\mathrm{B}\big(\frac{1}{2}, \frac{c}{2}\big)},$
 *
 * where $c > 0$. Support: $x \in \[-1, 1\]$.
 *
 * @class R
 * @memberof ran.dist
 * @constructor
 */
export default class R extends Beta {
  /**
   * @param {number} c Shape parameter.
   */
  constructor (c) {
    // Affine reduction: U = (X+1)/2 ~ Beta(c/2, c/2). See solutions/correctness/2026-05-19-1730-r-distribution-mixed-beta-reductions.md — one-to-one map onto [-1, 1] avoids the 0·∞ corner that the squared-variable reduction hits at x=0 for c<2.
    super(c / 2, c / 2)

    // Validate parameters
    this.p = Object.assign(this.p, { c })
    Distribution.validate({ c }, [
      'c > 0'
    ])

    // Set support
    this.s = [{
      value: -1,
      closed: true
    }, {
      value: 1,
      closed: true
    }]
  }

  // Blocks Beta's log-barrier: fit() operates in native c space, not (alpha, beta). See decisions/0017-beta-fit-penalty.md §3.
  static _fitPenalty () { return 0 }

  static _fitInit (data) {
    // Var[X] = 1/(c+1) on [-1, 1] ⇒ c = 1/Var − 1; overrides Beta's [alpha, beta] init
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1
    return [Math.max(1 / variance - 1, 1e-3)]
  }

  _generator () {
    return 2 * super._generator() - 1
  }

  _pdf (x) {
    return 0.5 * super._pdf((x + 1) / 2)
  }

  _cdf (x) {
    return super._cdf((x + 1) / 2)
  }

  /**
   * @returns {number} The mean of the distribution (zero by symmetry).
   */
  mean () {
    return 0
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    return 1 / (this.p.c + 1)
  }
}
