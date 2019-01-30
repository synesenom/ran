import { erf } from '../special'
import { normal } from './_standard'
import Distribution from './_distribution'

/**
 * Generator for the [normal distribution]{@link https://en.wikipedia.org/wiki/Normal_distribution}:
 *
 * $$f(x; \mu, \sigma) = \frac{1}{\sqrt{2 \pi \sigma^2}} e^{-\frac{(x - \mu)^2}{2\sigma^2}},$$
 *
 * with \(\mu \in \mathbb{R}\) and \(\sigma \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}\).
 *
 * @class Normal
 * @memberOf ran.dist
 * @param {number=} mu Location parameter (mean). Default value is 0.
 * @param {number=} sigma Squared scale parameter (variance). Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (mu = 0, sigma = 1) {
    super('continuous', arguments.length)
    this.p = { mu, sigma }
    this.s = [{
      value: null,
      closed: false
    }, {
      value: null,
      closed: false
    }]
    this.c = [sigma * Math.sqrt(2 * Math.PI), sigma * Math.SQRT2]
  }

  _generator () {
    // Direct sampling
    return normal(this.p.mu, this.p.sigma)
  }

  _pdf (x) {
    return Math.exp(-0.5 * Math.pow((x - this.p.mu) / this.p.sigma, 2)) / this.c[0]
  }

  _cdf (x) {
    return 0.5 * (1 + erf((x - this.p.mu) / this.c[1]))
  }
}