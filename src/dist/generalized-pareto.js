import Distribution from './_distribution'

/**
 * Generator for the [generalized Pareto distribution]{@link https://en.wikipedia.org/wiki/Generalized_Pareto_distribution}:
 *
 * $f(x; \mu, \sigma, \xi) = \begin{cases}\frac{1}{\sigma} (1 + \xi z)^{-(1/\xi + 1)} &\quad\text{if $\xi \ne 0$},\\\\\frac{1}{\sigma} e^{-z} &\quad\text{if $\xi = 0$}\\\\\end{cases},$
 *
 * with $\mu, \xi \in \mathbb{R}$, $\sigma > 0$ and $z = \frac{x - \mu}{\sigma}$. Support: $x \in [\mu, \infty)$ if $\xi \ge 0$, $x \in \[\mu, \mu - \sigma / \xi\]$ otherwise.
 *
 * @class GeneralizedPareto
 * @memberof ran.dist
 * @constructor
 */
export default class GeneralizedPareto extends Distribution {
  /**
   * @param {number} mu Location parameter.
   * @param {number} sigma Scale parameter.
   * @param {number} xi Shape parameter.
   */
  constructor (mu, sigma, xi) {
    super('continuous', 3)

    // Validate parameters
    this.p = { mu, sigma, xi }
    Distribution.validate({ mu, sigma, xi }, [
      'sigma > 0'
    ])

    // Set support
    this.s = [{
      value: mu,
      closed: true
    }, {
      value: xi < 0 ? mu - sigma / xi : Infinity,
      closed: xi < 0
    }]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const z = (x - this.p.mu) / this.p.sigma
    return this.p.xi === 0
      ? Math.exp(-z) / this.p.sigma
      : Math.pow(1 + this.p.xi * z, -1 / this.p.xi - 1) / this.p.sigma
  }

  _cdf (x) {
    const z = (x - this.p.mu) / this.p.sigma
    return this.p.xi === 0
      // -expm1(-z) avoids catastrophic cancellation when z = (x-mu)/sigma is near 0
      ? -Math.expm1(-z)
      // -expm1(-log1p(xi*z)/xi) avoids cancellation when xi*z is near 0
      : -Math.expm1(-Math.log1p(this.p.xi * z) / this.p.xi)
  }

  _q (p) {
    const y = this.p.xi === 0 ? -Math.log(1 - p) : (Math.pow(1 - p, -this.p.xi) - 1) / this.p.xi
    return this.p.mu + this.p.sigma * y
  }
}
