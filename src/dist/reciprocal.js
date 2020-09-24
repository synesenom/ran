import Distribution from './_distribution'

/**
 * Generator for the [reciprocal distribution]{@link https://en.wikipedia.org/wiki/Reciprocal_distribution}:
 *
 * $$f(x; a, b) = \frac{1}{x [\ln b - \ln a]},$$
 *
 * with \(a, b > 0\) and \(a < b\). Support: \(x \in [a, b]\).
 *
 * @class Reciprocal
 * @memberof ran.dist
 * @param {number=} a Lower boundary of the support. Default value is 1.
 * @param {number=} b Upper boundary of the support. Default value is 2.
 * @constructor
 */
export default class extends Distribution {
  constructor (a = 1, b = 2) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { a, b }
    Distribution.validate({ a, b }, [
      'a > 0',
      'b > 0',
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
      Math.log(a),
      Math.log(b)
    ]
  }

  _generator () {
    // Direct sampling
    return this.p.a * Math.exp((this.c[1] - this.c[0]) * this.r.next())
  }

  _pdf (x) {
    return 1 / (x * (this.c[1] - this.c[0]))
  }

  _cdf (x) {
    return (Math.log(x) - this.c[0]) / (this.c[1] - this.c[0])
  }
}
