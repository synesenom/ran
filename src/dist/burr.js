import Distribution from './_distribution'

/**
 * Generator for the [Burr (XII) distribution]{@link https://en.wikipedia.org/wiki/Burr_distribution} (also known as
 * Singh-Maddala distribution):
 *
 * $$f(x; c, k) = c k \frac{x^{c - 1}}{(1 + x^c)^{k + 1}},$$
 *
 * with \(c, k > 0\). Support: \(x > 0\).
 *
 * @class Burr
 * @memberof ran.dist
 * @param {number=} c First shape parameter. Default value is 1.
 * @param {number=} k Second shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (c = 1, k = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { c, k }
    Distribution.validate({ c, k }, [
      'c > 0',
      'k > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    this.c = [
      c * k,
      -1 / k,
      1 / c
    ]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const y = Math.pow(x, this.p.c)
    return this.c[0] * y / (x * Math.pow(1 + y, this.p.k + 1))
  }

  _cdf (x) {
    return 1 - Math.pow(1 + Math.pow(x, this.p.c), -this.p.k)
  }

  _q (p) {
    return Math.pow(Math.pow(1 - p, this.c[1]) - 1, this.c[2])
  }
}
