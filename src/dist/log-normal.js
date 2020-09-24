import Normal from './normal'

/**
 * Generator for the [log-normal distribution]{@link https://en.wikipedia.org/wiki/Log-normal_distribution}:
 *
 * $$f(x; \mu, \sigma) = \frac{1}{x \sigma \sqrt{2 \pi}}e^{-\frac{(\ln x - \mu)^2}{2\sigma^2}},$$
 *
 * where \(\mu \in \mathbb{R}\) and \(\sigma > 0\). Support: \(x > 0\).
 *
 * @class LogNormal
 * @memberof ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} sigma Scale parameter. Default value is 1.
 * @constructor
 */
export default class extends Normal {
  // Transforming normal distribution
  constructor (mu = 0, sigma = 1) {
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
    // Direct sampling by transforming normal variate
    return Math.exp(super._generator())
  }

  _pdf (x) {
    return super._pdf(Math.log(x)) / x
  }

  _cdf (x) {
    return super._cdf(Math.log(x))
  }

  _q (p) {
    return Math.exp(super._q(p))
  }
}
