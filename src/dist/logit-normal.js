import { erf } from '../special'
import { normal } from './_standard'
import Distribution from './_distribution'

function logit (x) {
  return Math.log(x / (1 - x))
}

/**
 * Generator for the [logit-normal distribution]{@link https://en.wikipedia.org/wiki/Logit-normal_distribution}:
 *
 * $$f(x; \mu, \sigma) = \frac{1}{\sigma \sqrt{2 \pi} x (1 - x)} e^{-\frac{[\mathrm{logit}(x) - \mu]^2}{\sigma^2}},$$
 *
 * with \(\mu \in \mathbb{R}\), \(\sigma \in \mathbb{R}^+\) and \(\mathrm{logit}(x) = \ln \frac{x}{1 - x}\). Support: \(x \in (0, 1)\).
 *
 * @class LogitNormal
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
      value: 1,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling by transforming normal variate
    return 1 / (1 + Math.exp(-normal(this.p.mu, this.p.sigma)))
  }

  _pdf (x) {
    return Math.exp(-0.5 * Math.pow((logit(x) - this.p.mu) / this.p.sigma, 2)) / (x * (1 - x) * this.p.sigma * Math.sqrt(2 * Math.PI))
  }

  _cdf (x) {
    return 0.5 * (1 + erf((logit(x) - this.p.mu) / (Math.SQRT2 * this.p.sigma)))
  }
}
