import Beta from './beta'
import Distribution from './_distribution'
import { regularizedBetaIncomplete } from '../special'
import rBeta from './_beta'

/**
 * Probability density function for the [PERT distribution]{@link https://en.wikipedia.org/wiki/PERT_distribution}:
 *
 * $f(x; a, b, c) = \frac{(x - a)^{\alpha - 1} (c - x)^{\beta - 1}}{\mathrm{B}(\alpha, \beta) (c - a)^{\alpha + \beta + 1}},$
 *
 * where $a, b, c \in \mathbb{R}$, $a < b < c$, $\alpha = \frac{4b + c - 5a}{c - a}$, $\beta = \frac{5c - a -4b}{c - a}$ and $\mathrm{B}(x, y)$ is the beta function. Support: $x \in [a, c]$.
 *
 * @class PERT
 * @memberof ran.dist
 * @constructor
 */
export default class PERT extends Beta {
  /**
   * @param {number} a Lower boundary of the support.
   * @param {number} b Mode of the distribution.
   * @param {number} c Upper boundary of the support.
   */
  constructor (a, b, c) {
    const alpha = (4 * b + c - 5 * a) / (c - a)
    const beta = (5 * c - a - 4 * b) / (c - a)
    super(alpha, beta)

    // PERT has 3 free parameters (a, b, c); override the 2 inherited from Beta
    // solutions/distribution/2026-06-07-2138-continuous-subclass-natural-params.md
    this.k = 3

    // decisions/0018-continuous-subclass-natural-params.md — natural params only in this.p;
    // Beta's alpha/beta move to this.c for _generator/_cdf/variance, which otherwise delegated
    // to Beta.prototype or read this.p.alpha/this.p.beta directly.
    Object.assign(this.c, { alpha, beta })

    // Validate parameters
    this.p = { a, b, c }
    Distribution.validate({ a, b, c }, [
      'a < b',
      'b < c'
    ])

    // Set support
    this.s = [{
      value: a,
      closed: true
    }, {
      value: c,
      closed: true
    }]
  }

  _generator () {
    // Direct sampling by transforming beta variate
    return rBeta(this.r, this.c.alpha, this.c.beta) * (this.p.c - this.p.a) + this.p.a
  }

  // Beta.prototype._pdf reads only this.c.{alphaM1,betaM1,lnBeta} (set by Beta's own constructor,
  // unaffected by moving alpha/beta out of this.p), so delegating to it remains safe.
  _pdf (x) {
    return super._pdf((x - this.p.a) / (this.p.c - this.p.a)) / (this.p.c - this.p.a)
  }

  _cdf (x) {
    return regularizedBetaIncomplete(this.c.alpha, this.c.beta, (x - this.p.a) / (this.p.c - this.p.a))
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return (this.p.a + 4 * this.p.b + this.p.c) / 6
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    // alpha+beta = 6 always for PERT; variance of Beta(alpha,beta) on [a,c] = (c-a)^2 * alpha*beta / 252
    return (this.p.c - this.p.a) ** 2 * this.c.alpha * this.c.beta / 252
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const { alpha, beta } = this.c
    const s = alpha + beta
    return 2 * (beta - alpha) * Math.sqrt(s + 1) / ((s + 2) * Math.sqrt(alpha * beta))
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

  // Blocks Beta's log-barrier: fit() operates in (a, b, c) space, not (alpha, beta). See decisions/0017-beta-fit-penalty.md §3.
  static _fitPenalty () { return 0 }

  static _fitInit (data) {
    // Endpoints from sample extremes; mode via PERT mean formula: E[X] = (a+4b+c)/6 → b = (6μ̂ - a - c)/4
    const n = data.length
    const lo = Math.min(...data)
    const hi = Math.max(...data)
    const eps = (hi - lo) * 0.01 || 1e-6
    const a = lo - eps
    const c = hi + eps
    const mean = data.reduce((s, x) => s + x, 0) / n
    const b = Math.max(a + eps, Math.min(c - eps, (6 * mean - a - c) / 4))
    return [a, b, c]
  }
}
