import { riemannZeta, gamma } from '../special'
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
   * @param {number} n Shape parameter. Must not equal 1.
   */
  constructor (mu, b, n) {
    super('continuous', 3)

    // Validate parameters.
    this.p = { mu, b, n }
    Distribution.validate({ mu, b, n }, [
      'mu > 0',
      'b > 0',
      'n > 0', 'n != 1'
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
    return 1
  }

  _pdf (x) {
    return this.p.b ** this.p.n * Math.pow(x - this.p.mu, -1 - this.p.n) / gamma(this.p.n) / riemannZeta(this.p.n) / (Math.exp(this.p.b / (x - this.p.mu)) - 1)
  }

  _cdf (x) {
    if (x <= this.p.mu) {
      return 0
    }
    return romberg(t => this._pdf(t), this.p.mu, x)
  }
}
