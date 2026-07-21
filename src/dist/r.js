import Beta from './beta'
import Distribution from './_distribution'
import { regularizedBetaIncomplete } from '../special'
import rBeta from './_beta'

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

    // R has 1 free parameter (c); override the 2 inherited from Beta
    // solutions/distribution/2026-06-07-2138-continuous-subclass-natural-params.md
    this.k = 1

    // decisions/0018-continuous-subclass-natural-params.md — natural params only in this.p;
    // Beta's alpha/beta move to this.c for _generator/_cdf, which otherwise delegated to
    // Beta.prototype and read them off this.p.
    Object.assign(this.c, { alpha: c / 2, beta: c / 2 })

    // Validate parameters
    this.p = { c }
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
    return 2 * rBeta(this.r, this.c.alpha, this.c.beta) - 1
  }

  // Beta.prototype._pdf reads only this.c.{alphaM1,betaM1,lnBeta} (set by Beta's own constructor,
  // unaffected by moving alpha/beta out of this.p), so delegating to it remains safe.
  _pdf (x) {
    return 0.5 * super._pdf((x + 1) / 2)
  }

  _cdf (x) {
    return regularizedBetaIncomplete(this.c.alpha, this.c.beta, (x + 1) / 2)
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

  /**
   * @returns {number} The skewness of the distribution (zero by construction: alpha === beta === c/2).
   */
  skewness () {
    return 0
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const { alpha, beta } = this.c
    const s = alpha + beta
    return 6 * ((alpha - beta) ** 2 * (s + 1) - alpha * beta * (s + 2)) /
      (alpha * beta * (s + 2) * (s + 3))
  }
}
