import Distribution from './_distribution'

/**
 * Generator for the [generalized Pareto distribution]{@link https://en.wikipedia.org/wiki/Generalized_Pareto_distribution}:
 *
 * $$fx; \mu, \sigma, \xi) = \begin{cases}\frac{1}{\sigma} (1 + \xi z)^{-(1/\xi + 1)} &\quad\text{if $\xi \ne 0$},\\\frac{1}{\sigma} e^{-z} &\quad\text{if $\xi = 0$}\\\end{cases},$$
 *
 * with \(\mu, \xi \in \mathbb{R}\), \(\sigma \in \mathbb{R}^+\) and \(z = \frac{x - \mu}{\sigma}\). Support: \(x \in [\mu, \infty)\) if \(\xi \ge 0\), \(x \in [\mu, \mu - \sigma / \xi]\) otherwise.
 *
 * @class GeneralizedPareto
 * @memberOf ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} sigma Scale parameter. Default value is 1.
 * @param {number=} xi Shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (mu = 0, sigma = 1, xi = 1) {
    super('continuous', arguments.length)
    this.p = { mu, sigma, xi }
    this.s = [{
      value: mu,
      closed: true
    }, {
      value: xi < 0 ? mu - sigma / xi : Infinity,
      closed: xi < 0
    }]
  }

  _generator () {
    // Inverse sampling
    let u = this.r.next()
    let y = this.p.xi === 0 ? -Math.log(u) : (Math.pow(u, -this.p.xi) - 1) / this.p.xi
    return this.p.mu + this.p.sigma * y
  }

  _pdf (x) {
    let z = (x - this.p.mu) / this.p.sigma
    return this.p.xi === 0
      ? Math.exp(-z) / this.p.sigma
      : Math.pow(1 + this.p.xi * z, -1 / this.p.xi - 1) / this.p.sigma
  }

  _cdf (x) {
    let z = (x - this.p.mu) / this.p.sigma
    return this.p.xi === 0
      ? 1 - Math.exp(-z)
      : 1 - Math.pow(1 + this.p.xi * z, -1 / this.p.xi)
  }

  _q (p) {
    let y = this.p.xi === 0 ? -Math.log(1 - p) : (Math.pow(1 - p, -this.p.xi) - 1) / this.p.xi
    return this.p.mu + this.p.sigma * y
  }
}
