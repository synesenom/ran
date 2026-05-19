import Distribution from './_distribution'

/**
 * Generator for the [Gamma/Gompertz distribution]{@link https://en.wikipedia.org/wiki/Gamma/Gompertz_distribution}:
 *
 * $$f(x; b, s, \beta) = \frac{b s e^{b x} \beta^s}{(\beta - 1 + e^{b x})^{s + 1}},$$
 *
 * with $b, s, \beta > 0$. Support: $x \ge 0$.
 *
 * @class GammaGompertz
 * @memberof ran.dist
 * @param {number=} b Scale parameter. Default value is 1.
 * @param {number=} s First shape parameter. Default value is 1.
 * @param {number=} beta Second shape parameter. Default value is 1.
 * @see https://en.wikipedia.org/wiki/Gamma/Gompertz_distribution
 * @constructor
 */
export default class extends Distribution {
  constructor (b, s, beta) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { b, s, beta }
    Distribution.validate({ b, s, beta }, [
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
    const y = Math.exp(this.p.b * x)
    const z = Math.pow(this.p.beta - 1 + y, this.p.s + 1)
    return Number.isFinite(y) && Number.isFinite(z) ? this.p.b * this.p.s * Math.pow(this.p.beta, this.p.s) * y / z : 0
  }

  _cdf (x) {
    // expm1 for exp(b*x)-1 near x=0; log1p+expm1 avoids cancellation in 1-(1+u)^{-s}
    return -Math.expm1(-this.p.s * Math.log1p(Math.expm1(this.p.b * x) / this.p.beta))
  }

  _q (p) {
    return Math.log(1 + this.p.beta * (Math.pow(1 - p, -1 / this.p.s) - 1)) / this.p.b
  }
}
