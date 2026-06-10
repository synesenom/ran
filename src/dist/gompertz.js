import Distribution from './_distribution'

/**
 * Probability density function for the [Gompertz distribution]{@link https://en.wikipedia.org/wiki/Gompertz_distribution}:
 *
 * $f(x; \eta, b) = b \eta e^{\eta + bx - \eta e^{bx}} ,$
 *
 * with $\eta, b > 0$. Support: $x \ge 0$.
 *
 * Cumulative distribution function:
 *
 * $F(x; \eta, b) = 1 - \exp\!\left(-\eta\left(e^{bx} - 1\right)\right)$
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

  static _fitInit (data) {
    // No closed-form MOM; seed eta≈1 and b≈1/mean so the exponential growth scale matches the data (mean floored for degenerate all-zero data)
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    return [1, 1 / Math.max(mean, 1e-3)]
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
