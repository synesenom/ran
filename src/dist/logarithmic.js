import { lambertW0 } from '../special/lambert-w'
import Distribution from './_distribution'

/**
 * Generator for the (continuous) [logarithmic distribution]{@link http://mathworld.wolfram.com/LogarithmicDistribution.html}:
 *
 * $$f(x; a, b) = \frac{\ln x}{a (1 - \ln a) - b (1 - \ln b)},$$
 *
 * with \(a, b \in [1, \infty)\) and \(a < b\). Support: \(x \in [a, b]\).
 *
 * @class Logarithmic
 * @memberof ran.dist
 * @param {number=} a Lower boundary of the distribution. Default value is 1.
 * @param {number=} b Upper boundary of the distribution. Default value is 2.
 * @constructor
 */
export default class extends Distribution {
  constructor (a = 1, b = 2) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { a, b }
    Distribution.validate({ a, b }, [
      'a >= 1',
      'b >= 1',
      'a < b'
    ])

    // Set support
    this.s = [{
      value: a,
      closed: true
    }, {
      value: b,
      closed: true
    }]

    // Speed-up constants
    this.c = [
      a * (1 - Math.log(a)),
      b * (1 - Math.log(b))
    ]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return Math.log(x) / (this.c[0] - this.c[1])
  }

  _cdf (x) {
    return (this.c[0] - x * (1 - Math.log(x))) / (this.c[0] - this.c[1])
  }

  _q (p) {
    const z = p * (this.c[0] - this.c[1]) - this.c[0]
    return z / lambertW0(z / Math.E)
  }
}
