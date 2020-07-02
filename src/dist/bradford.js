import Distribution from './_distribution'

/**
 * Generator for the [Bradford distribution]{@link https://docs.scipy.org/doc/scipy/reference/tutorial/stats/continuous_bradford.html}:
 *
 * $$f(x; c) = \frac{c}{\ln(1 + c) (1 + c x)},$$
 *
 * with \(c > 0\). Support: \(x \in [0, 1]\).
 *
 * @class Bradford
 * @memberOf ran.dist
 * @param {number=} c Shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (c = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { c }
    Distribution.validate({ c }, [
      'c > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: 1,
      closed: true
    }]

    // Speed-up constants
    const c0 = Math.log(1 + c)
    this.c = [
      c0,
      c / c0
    ]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return this.c[1] / (1 + this.p.c * x)
  }

  _cdf (x) {
    return Math.log(1 + this.p.c * x) / this.c[0]
  }

  _q (p) {
    return (Math.exp(this.c[0] * p) - 1) / this.p.c
  }
}
