import Cauchy from './cauchy'

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
export default class extends Cauchy {
  // Transforming Cauchy distribution
  constructor (mu = 0, sigma = 1) {
    super(mu, sigma)
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling by transforming Cauchy variate
    return Math.exp(super._generator())
  }

  _pdf (x) {
    return super._pdf(Math.log(x)) / x
  }

  _cdf (x) {
    return super._cdf(Math.log(x))
  }
}
