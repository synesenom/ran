import Cauchy from './cauchy'

/**
 * Probability density function for the [log-Cauchy distribution]{@link https://en.wikipedia.org/wiki/Log-Cauchy_distribution}:
 *
 * $f(x; \mu, \sigma) = \frac{1}{\pi x}\bigg\[\frac{\sigma}{(\ln x - \mu)^2 + \sigma^2}\bigg\],$
 *
 * with $\mu \in \mathbb{R}$ and $\sigma > 0$. Support: $x > 0$.
 *
 * @class LogCauchy
 * @memberof ran.dist
 * @constructor
 */
export default class LogCauchy extends Cauchy {
  // Transforming Cauchy distribution
  /**
   * @param {number} mu Location parameter.
   * @param {number} sigma Scale parameter.
   */
  constructor (mu, sigma) {
    super(mu, sigma)

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]

    // decisions/0018-continuous-subclass-natural-params.md — natural params only in this.p
    // this.c.piGamma = π·sigma set by Cauchy constructor remains valid
    this.p = { mu, sigma }
  }

  _generator () {
    // Direct sampling by transforming Cauchy variate
    const z = this.p.mu + this.p.sigma * Math.tan(Math.PI * (this.r.next() - 0.5))

    // Handle |z| >> 1 cases
    return Math.max(Math.min(Number.MAX_VALUE, Math.exp(z)), Number.MIN_VALUE)
  }

  _pdf (x) {
    const y = (Math.log(x) - this.p.mu) / this.p.sigma
    return 1 / (this.c.piGamma * (1 + y * y) * x)
  }

  _cdf (x) {
    return 0.5 + Math.atan2(Math.log(x) - this.p.mu, this.p.sigma) / Math.PI
  }

  _q (p) {
    return Math.exp(this.p.mu + this.p.sigma * Math.tan(Math.PI * (p - 0.5)))
  }

  /**
   * @returns {number} Infinity (E[X] = ∫ x·f(x) dx substituting u=ln x gives ∫ e^u·Cauchy(u) du, which diverges to +∞ one-sidedly).
   */
  mean () { return Infinity }

  static _fitInit (data) {
    // log(Y) ~ Cauchy(x0, gamma): IQR on log scale avoids reliance on moments that don't exist
    const logData = data.map(x => Math.log(x)).sort((a, b) => a - b)
    const n = logData.length
    const mid = n % 2 ? logData[(n - 1) / 2] : (logData[n / 2 - 1] + logData[n / 2]) / 2
    const q1 = logData[Math.floor(n / 4)]
    const q3 = logData[Math.floor(3 * n / 4)]
    return [mid, Math.max((q3 - q1) / 2, 1e-3)]
  }
}
