import Normal from './normal'

/**
 * Generator for the [logit-normal distribution]{@link https://en.wikipedia.org/wiki/Logit-normal_distribution}:
 *
 * $$f(x; \mu, \sigma) = \frac{1}{\sigma \sqrt{2 \pi} x (1 - x)} e^{-\frac{[\mathrm{logit}(x) - \mu]^2}{2 \sigma^2}},$$
 *
 * with \(\mu \in \mathbb{R}\), \(\sigma \in \mathbb{R}^+\) and \(\mathrm{logit}(x) = \ln \frac{x}{1 - x}\). Support: \(x \in (0, 1)\).
 *
 * @class LogitNormal
 * @memberOf ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} sigma Scale parameter. Default value is 1.
 * @constructor
 */
export default class extends Normal {
  // Transforming normal distribution
  constructor (mu = 0, sigma = 1) {
    super(mu, sigma)
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: 1,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling by transforming normal variate
    return 1 / (1 + Math.exp(-super._generator()))
  }

  _pdf (x) {
    return super._pdf(Math.log(x / (1 - x))) / (x * (1 - x))
  }

  _cdf (x) {
    return super._cdf(Math.log(x / (1 - x)))
  }

  _q (p) {
    return 1 / (1 + Math.exp(-super._q(p)))
  }
}
