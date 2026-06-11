import Distribution from './_distribution'

/**
 * Probability density function for the [generalized Pareto distribution]{@link https://en.wikipedia.org/wiki/Generalized_Pareto_distribution}:
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

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    const { mu, sigma, xi } = this.p
    return xi < 1 ? mu + sigma / (1 - xi) : Infinity
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const { sigma, xi } = this.p
    return xi < 0.5 ? sigma * sigma / ((1 - xi) * (1 - xi) * (1 - 2 * xi)) : Infinity
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const { xi } = this.p
    if (xi < 1 / 3) return 2 * (1 + xi) * Math.sqrt(1 - 2 * xi) / (1 - 3 * xi)
    // variance finite (xi<0.5) but third moment diverges: standardized ratio -> Infinity not NaN
    return xi < 0.5 ? Infinity : NaN
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const { xi } = this.p
    if (xi < 0.25) return 3 * (1 - 2 * xi) * (2 * xi * xi + xi + 3) / ((1 - 3 * xi) * (1 - 4 * xi)) - 3
    return xi < 0.5 ? Infinity : NaN
  }

  static _fitInit (data) {
    // mu at data minimum as threshold; MOM on shifted excesses: Var/E^2 = 1/(1-2*xi) gives xi and sigma
    const mu = Math.min(...data)
    const n = data.length
    const y = data.map(x => x - mu)
    const mean = y.reduce((s, x) => s + x, 0) / n
    const variance = y.reduce((s, x) => s + (x - mean) ** 2, 0) / n
    if (variance < 1e-9) {
      return [mu, Math.max(mean, 1e-3), 0]
    }
    const xi = Math.max(Math.min(0.5 * (1 - mean * mean / variance), 0.4), -5)
    return [mu, Math.max(mean * (1 - xi), 1e-3), xi]
  }
}
