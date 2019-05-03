import Distribution from './_distribution'

/**
 * Generator for the [Gamma/Gompertz distribution]{@link https://en.wikipedia.org/wiki/Gamma/Gompertz_distribution}:
 *
 * $$f(x; b, s, \beta) = \frac{b s e^{b x} \beta^s}{(\beta - 1 + e^{b x})^{s + 1}},$$
 *
 * with \(b, s, \beta > 0\). Support: \(x \ge 0\).
 *
 * @class GammaGompertz
 * @memberOf ran.dist
 * @param {number=} b Scale parameter. Default value is 1.
 * @param {number=} s First shape parameter. Default value is 1.
 * @param {number=} beta Second shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (b = 1, s = 1, beta = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { b, s, beta }
    Distribution._validate({ b, s, beta }, [
      'b > 0',
      's > 0',
      'beta > 0'
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
    let y = Math.exp(this.p.b * x)
    let z = Math.pow(this.p.beta - 1 + y, this.p.s + 1)
    return isFinite(y) && isFinite(z) ? this.p.b * this.p.s * Math.pow(this.p.beta, this.p.s) * y / z : 0
  }

  _cdf (x) {
    return 1 - Math.pow(1 + (Math.exp(this.p.b * x) - 1) / this.p.beta, -this.p.s)
  }

  _q (p) {
    return Math.log(1 + this.p.beta * (Math.pow(1 - p, -1 / this.p.s) - 1)) / this.p.b
  }
}
