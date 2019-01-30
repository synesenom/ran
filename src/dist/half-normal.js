import { erf } from '../special'
import { normal } from './_standard'
import Distribution from './_distribution'

/**
 * Generator for the [half-normal distribution]{@link https://en.wikipedia.org/wiki/Half-normal_distribution}:
 *
 * $$f(x; \sigma) = \frac{\sqrt{2}}{\sigma\sqrt{\pi}} e^{-\frac{x^2}{2\sigma^2}},$$
 *
 * with \(\sigma \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+ \cup \{0\}\).
 *
 * @class HalfNormal
 * @memberOf ran.dist
 * @param {number=} sigma Scale parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (sigma = 1) {
    super('continuous', arguments.length)
    this.p = { sigma }
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling from normal
    return Math.abs(normal(0, this.p.sigma))
  }

  _pdf (x) {
    return Math.SQRT2 * Math.exp(-0.5 * Math.pow(x / this.p.sigma, 2)) / (Math.sqrt(Math.PI) * this.p.sigma)
  }

  _cdf (x) {
    return erf(x / (this.p.sigma * Math.SQRT2))
  }
}
