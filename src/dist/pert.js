import Beta from './beta'
import Distribution from './_distribution'

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
    super((4 * b + c - 5 * a) / (c - a), (5 * c - a - 4 * b) / (c - a))

    // Validate parameters
    this.p = Object.assign(this.p, { a, b, c })
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
    return super._generator() * (this.p.c - this.p.a) + this.p.a
  }

  _pdf (x) {
    return super._pdf((x - this.p.a) / (this.p.c - this.p.a)) / (this.p.c - this.p.a)
  }

  _cdf (x) {
    return super._cdf((x - this.p.a) / (this.p.c - this.p.a))
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
    return (this.p.c - this.p.a) ** 2 * this.p.alpha * this.p.beta / 252
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
