import Distribution from './_distribution'

/**
 * Generator for the [log-Cauchy distribution]{@link https://en.wikipedia.org/wiki/Log-Cauchy_distribution}:
 *
 * $$f(x; \mu, \sigma) = \frac{1}{\pi x}\bigg[\frac{\sigma}{(\ln x - \mu)^2 + \sigma^2}\bigg],$$
 *
 * with \(\mu \in \mathbb{R}\) and \(\sigma \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
 *
 * @class LogCauchy
 * @memberOf ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} sigma Scale parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (mu = 0, sigma = 1) {
    super('continuous', arguments.length)
    this.p = { mu, sigma }
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    return Math.exp(this.p.mu + this.p.sigma * Math.tan(Math.PI * (Math.random() - 0.5)))
  }

  _pdf (x) {
    return this.p.sigma / (x * Math.PI * (this.p.sigma * this.p.sigma + Math.pow(Math.log(x) - this.p.mu, 2)))
  }

  _cdf (x) {
    return 0.5 + Math.atan2(Math.log(x) - this.p.mu, this.p.sigma) / Math.PI
  }
}
