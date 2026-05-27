import { riemannZeta, gamma as gammaFn } from '../special'
import gamma from './_gamma'
import zeta from './_zeta'
import Distribution from './_distribution'
import { romberg } from '../algorithms'

/**
 * Generator for the [Davis distribution]{@link https://en.wikipedia.org/wiki/Davis_distribution}:
 *
 * $f(x; \mu, b, n) = \frac{b^n (x - \mu)^{-1-n}}{\Gamma(n)\, \zeta(n)\, \left(e^{b/(x-\mu)} - 1\right)},$
 *
 * with $\mu > 0$, $b > 0$, and $n > 0, n \neq 1$. Support: $x \in (\mu, \infty)$.
 *
 * @class Davis
 * @memberof ran.dist
 * @constructor
 */
export default class Davis extends Distribution {
  /**
   * @param {number} mu Location parameter.
   * @param {number} b Scale parameter.
   * @param {number} n Shape parameter. Must be greater than 1.
   */
  constructor (mu, b, n) {
    super('continuous', 3)

    // Validate parameters.
    this.p = { mu, b, n }
    Distribution.validate({ mu, b, n }, [
      'mu > 0',
      'b > 0',
      'n > 1'
    ])

    // Set support.
    this.s = [{
      value: mu,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Zeta-Gamma mixture: Davis(mu, b, n) = mu + b / Gamma(n, Zeta(n))
    const k = zeta(this.r, this.p.n)
    return this.p.mu + this.p.b / gamma(this.r, this.p.n, k)
  }

  _pdf (x) {
    const y = x - this.p.mu
    if (y <= 0) return 0
    const bOverY = this.p.b / y
    // exp(bOverY) overflows to Infinity for bOverY > ~709; PDF → 0 in that limit
    if (bOverY > 700) return 0
    return Math.pow(this.p.b, this.p.n) * Math.pow(y, -1 - this.p.n) / (gammaFn(this.p.n) * riemannZeta(this.p.n) * (Math.exp(bOverY) - 1))
  }

  _cdf (x) {
    if (x <= this.p.mu) {
      return 0
    }
    return romberg(t => this._pdf(t), this.p.mu, x)
  }
}
