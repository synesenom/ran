import { erf } from '../special'
import { normal } from './_standard'
import Distribution from './_distribution'

/**
 * Generator for the [log-normal distribution]{@link https://en.wikipedia.org/wiki/Log-normal_distribution}:
 *
 * $$f(x; \mu, \sigma) = \frac{1}{x \sigma \sqrt{2 \pi}}e^{-\frac{(\ln x - \mu)^2}{2\sigma^2}},$$
 *
 * where \(\mu \in \mathbb{R}\) and \(\sigma \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
 *
 * @class LogNormal
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
    this.c = [sigma * Math.sqrt(2 * Math.PI), sigma * Math.SQRT2]
  }

  _generator () {
    // Direct sampling from normal
    return Math.exp(this.p.mu + this.p.sigma * normal(0, 1))
  }

  _pdf (x) {
    return Math.exp(-0.5 * Math.pow((Math.log(x) - this.p.mu) / this.p.sigma, 2)) / (x * this.c[0])
  }

  _cdf (x) {
    return 0.5 * (1 + erf((Math.log(x) - this.p.mu) / this.c[1]))
  }
}
