import Distribution from './_distribution'

/**
 * Generator for the [Gompertz distribution]{@link https://en.wikipedia.org/wiki/Gompertz_distribution}:
 *
 * $$f(x; \eta, b) = b \eta e^{\eta + bx - \eta e^{bx}} ,$$
 *
 * with \(\eta, b > 0\). Support: \(x \ge 0\).
 *
 * @class Gompertz
 * @memberOf ran.dist
 * @param {number=} eta Shape parameter. Default value is 1.
 * @param {number=} beta Scale parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (eta = 1, b = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { eta, b }
    Distribution.validate({ eta, b }, [
      'eta > 0',
      'b > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
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
    return this.p.b * this.p.eta * Math.exp(this.p.eta + this.p.b * x - this.p.eta * Math.exp(this.p.b * x))
  }

  _cdf (x) {
    return 1 - Math.exp(-this.p.eta * (Math.exp(this.p.b * x) - 1))
  }

  _q (p) {
    return Math.log(1 - Math.log(1 - p) / this.p.eta) / this.p.b
  }
}
