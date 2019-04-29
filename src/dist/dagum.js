import Distribution from './_distribution'

/**
 * Generator for the [Dagum distribution]{@link https://en.wikipedia.org/wiki/Dagum_distribution}:
 *
 * $$f(x; p, a, b) = \frac{ap}{x} \frac{\big(\frac{x}{b}\big)^{ap}}{\Big[\big(\frac{x}{b}\big)^a + 1\Big]^{p + 1}},$$
 *
 * with \(p, a, b > 0\). Support: \(x > 0\).
 *
 * @class Dagum
 * @memberOf ran.dist
 * @param {number=} p First shape parameter. Default value is 1.
 * @param {number=} a Second shape parameter. Default value is 1.
 * @param {number=} b Scale parameter. Default value is 1.
 */
export default class extends Distribution {
  constructor (p = 1, a = 1, b = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { p, a, b }
    this._validate({ p, a, b }, [
      'p > 0',
      'a > 0',
      'b > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    let y = Math.pow(x / this.p.b, this.p.a)
    return this.p.a * this.p.p * Math.pow(y, this.p.p) / (x * Math.pow(y + 1, this.p.p + 1))
  }

  _cdf (x) {
    return Math.pow(1 + Math.pow(x / this.p.b, -this.p.a), -this.p.p)
  }

  _q (p) {
    return this.p.b * Math.pow(Math.pow(p, -1 / this.p.p) - 1, -1 / this.p.a)
  }
}
