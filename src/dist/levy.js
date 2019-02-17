import { erf } from '../special'
import { normal } from './_core'
import Distribution from './_distribution'

/**
 * Generator for the [Levy distribution]{@link https://en.wikipedia.org/wiki/Lévy_distribution}:
 *
 * $$f(x; \mu, c) = \sqrt{\frac{c}{2 \pi}}\frac{e^{-\frac{c}{2(x - \mu)}}}{(x - \mu)^{3/2}},$$
 *
 * with \(\mu \in \mathbb{R}\) and \(c \in \mathbb{R}^+\). Support: \(x \in [\mu, \infty)\).
 *
 * @class Levy
 * @memberOf ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} c Scale parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (mu = 0, c = 1) {
    super('continuous', arguments.length)
    this.p = { mu, c }
    this.s = [{
      value: mu,
      closed: true
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling by transforming normal variate
    let y = normal(0, 1 / Math.sqrt(this.p.c))
    return this.p.mu + 1 / (y * y)
  }

  _pdf (x) {
    let z = x - this.p.mu
    return Math.sqrt(0.5 * this.p.c / Math.PI) * Math.exp(-0.5 * this.p.c / z - 1.5 * Math.log(z))
  }

  _cdf (x) {
    return 1 - erf(Math.sqrt(0.5 * this.p.c / (x - this.p.mu)))
  }
}
