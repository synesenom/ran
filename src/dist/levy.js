import { erfc } from '../special'
import { normal } from './_core'
import Distribution from './_distribution'

/**
 * Generator for the [Lévy distribution]{@link https://en.wikipedia.org/wiki/Lévy_distribution}:
 *
 * $$f(x; \mu, c) = \sqrt{\frac{c}{2 \pi}}\frac{e^{-\frac{c}{2(x - \mu)}}}{(x - \mu)^{3/2}},$$
 *
 * with $\mu \in \mathbb{R}$ and $c > 0$. Support: $x \in [\mu, \infty)$.
 *
 * @class Levy
 * @memberof ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} c Scale parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (mu = 0, c = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { mu, c }
    Distribution.validate({ mu, c }, [
      'c > 0'
    ])

    // Set support
    this.s = [{
      value: mu,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling by transforming normal variate
    const y = normal(this.r, 0, 1 / Math.sqrt(this.p.c))
    return this.p.mu + 1 / (y * y)
  }

  _pdf (x) {
    const z = x - this.p.mu
    return Math.sqrt(0.5 * this.p.c / Math.PI) * Math.exp(-0.5 * this.p.c / z - 1.5 * Math.log(z))
  }

  _cdf (x) {
    return x === this.p.mu ? 0 : erfc(Math.sqrt(0.5 * this.p.c / (x - this.p.mu)))
  }
}
