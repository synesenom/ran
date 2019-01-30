import { lambertW } from '../special'
import Distribution from './_distribution'

/**
 * Generator for the (continuous) [logarithmic distribution]{@link http://mathworld.wolfram.com/LogarithmicDistribution.html}:
 *
 * $$f(x; a, b) = \frac{\ln x}{a (1 - \ln a) - b (1 - \ln b)},$$
 *
 * with \(a, b \in \mathbb{R}^+ / (0, 1)\). Support: \(x \ in [a, b]\).
 *
 * @class Logarithmic
 * @memberOf ran.dist
 * @param {number=} a Lower boundary of the distribution. Default value is 1.
 * @param {number=} b Upper boundary of the distribution. Default value is 2.
 * @constructor
 */
export default class extends Distribution {
  constructor (a = 1, b = 2) {
    super('continuous', arguments.length)
    this.p = { a, b }
    this.s = [{
      value: a,
      closed: true
    }, {
      value: b,
      closed: true
    }]
    this.c = [
      a * (1 - Math.log(a)),
      b * (1 - Math.log(b))
    ]
  }

  _generator () {
    // Inverse transform sampling
    let z = Math.random() * (this.c[0] - this.c[1]) - this.c[0]
    return z / lambertW(z / Math.E)
  }

  _pdf (x) {
    return Math.log(x) / (this.c[0] - this.c[1])
  }

  _cdf (x) {
    return (this.c[0] - x * (1 - Math.log(x))) / (this.c[0] - this.c[1])
  }
}
