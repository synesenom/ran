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
    this.c = [
      Math.SQRT2 / (Math.sqrt(Math.PI) * sigma),
      -0.5 / (sigma * sigma),
      Math.SQRT1_2 / sigma
    ]
  }

  _generator () {
    // Direct sampling from normal
    return Math.abs(normal(0, this.p.sigma))
  }

  _pdf (x) {
    return this.c[0] * Math.exp(this.c[1] * x * x)
  }

  _cdf (x) {
    return erf(this.c[2] * x)
  }
}
