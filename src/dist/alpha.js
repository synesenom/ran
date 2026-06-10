import Distribution from './_distribution'
import { erf, erfinv } from '../special'

/**
 * Probability density function for the [alpha distribution]{@link https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/alppdf.htm}:
 *
 * $f(x; \alpha, \beta) = \frac{\phi\Big(\alpha - \frac{\beta}{x}\Big)}{x^2 \Phi(\alpha)},$
 *
 * where $\alpha, \beta > 0$ and $\phi(x), \Phi(x)$ denote the probability density and cumulative probability
 * functions of the [normal distribution]{@link #dist.Normal}.
 * Support: $x > 0$.
 *
 * Cumulative distribution function:
 *
 * $F(x; \alpha, \beta) = \frac{\Phi(\alpha - \beta/x)}{\Phi(\alpha)}$
 *
 * @class Alpha
 * @memberof ran.dist
 * @see Johnson, Kotz, and Balakrishnan, Continuous Univariate Distributions Vol. 1, 2nd ed., John Wiley and Sons, 1994, p. 173.
 * @constructor
 */
export default class Alpha extends Distribution {
  // Source: Johnson, Kotz, and Balakrishnan (1994). Continuous Univariate Distributions — Volume 1, Second Edition,
  // John Wiley and Sons, p. 173.
  /**
   * @param {number} alpha Shape parameter.
   * @param {number} beta Scale parameter.
   */
  constructor (alpha, beta) {
    super('continuous', 2)

    // Validate parameters
    this.p = { alpha, beta }
    Distribution.validate({ alpha, beta }, [
      'alpha > 0',
      'beta > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    this.c = {
      phiAlpha: this._phi(alpha),
      phiAlphaSqrt2Pi: this._phi(alpha) * Math.sqrt(2 * Math.PI)
    }
  }

  _phi (x) {
    return 0.5 * (1 + erf(x / Math.SQRT2))
  }

  _phiInv (x) {
    return Math.SQRT2 * erfinv(2 * x - 1)
  }

  static _fitInit (data) {
    // Large-alpha approximation: E[X]≈beta/alpha, CV≈1/alpha ⇒ alpha=mean/std, beta=mean²/std
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || mean * mean * 0.25
    const std = Math.sqrt(variance)
    return [Math.max(mean / std, 0.5), Math.max(mean * mean / std, 1e-3)]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return this.p.beta * Math.exp(-0.5 * Math.pow(this.p.alpha - this.p.beta / x, 2)) / (x * x * this.c.phiAlphaSqrt2Pi)
  }

  _cdf (x) {
    return this._phi(this.p.alpha - this.p.beta / x) / this.c.phiAlpha
  }

  _q (p) {
    return this.p.beta / (this.p.alpha - this._phiInv(p * this.c.phiAlpha))
  }
}
