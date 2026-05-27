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
  }

  _generator () {
    // Direct sampling by transforming Cauchy variate
    const z = super._generator()

    // Handle |z| >> 1 cases
    return Math.max(Math.min(Number.MAX_VALUE, Math.exp(z)), Number.MIN_VALUE)
  }

  _pdf (x) {
    return super._pdf(Math.log(x)) / x
  }

  _cdf (x) {
    return super._cdf(Math.log(x))
  }

  _q (p) {
    return Math.exp(this.p.x0 + this.p.gamma * Math.tan(Math.PI * (p - 0.5)))
  }
}
