import Distribution from './_distribution'

/**
 * Probability function for the [Gompertz distribution]{@link https://en.wikipedia.org/wiki/Gompertz_distribution}:
 *
 * $f(x; \eta, b) = b \eta e^{\eta + bx - \eta e^{bx}} ,$
 *
 * with $\eta, b > 0$. Support: $x \ge 0$.
 *
 * @class Gompertz
 * @memberof ran.dist
 * @constructor
 */
export default class Gompertz extends Distribution {
  /**
   * @param {number} eta Shape parameter.
   * @param {number} b Scale parameter.
   */
  constructor (eta, b) {
    super('continuous', 2)

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
    // Inner expm1 avoids cancellation in exp(b*x)-1 near x=0;
    // outer -expm1 avoids the 1-exp(-...) cancellation
    return -Math.expm1(-this.p.eta * Math.expm1(this.p.b * x))
  }

  _q (p) {
    return Math.log(1 - Math.log(1 - p) / this.p.eta) / this.p.b
  }
}
