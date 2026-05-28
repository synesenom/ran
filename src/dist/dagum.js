import Distribution from './_distribution'

/**
 * Probability density function for the [Dagum distribution]{@link https://en.wikipedia.org/wiki/Dagum_distribution}:
 *
 * $f(x; p, a, b) = \frac{ap}{x} \frac{\big(\frac{x}{b}\big)^{ap}}{\Big\[\big(\frac{x}{b}\big)^a + 1\Big\]^{p + 1}},$
 *
 * with $p, a, b > 0$. Support: $x > 0$.
 *
 * @class Dagum
 * @memberof ran.dist
 * @constructor
 */
export default class Dagum extends Distribution {
  /**
   * @param {number} p First shape parameter.
   * @param {number} a Second shape parameter.
   * @param {number} b Scale parameter.
   */
  constructor (p, a, b) {
    super('continuous', 3)

    // Validate parameters
    this.p = { p, a, b }
    Distribution.validate({ p, a, b }, [
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
    const y = Math.pow(x / this.p.b, this.p.a)
    return this.p.a * this.p.p * Math.pow(y, this.p.p) / (x * Math.pow(y + 1, this.p.p + 1))
  }

  _cdf (x) {
    return Math.pow(1 + Math.pow(x / this.p.b, -this.p.a), -this.p.p)
  }

  _q (p) {
    return this.p.b * Math.pow(Math.pow(p, -1 / this.p.p) - 1, -1 / this.p.a)
  }

  static _fitInit (data) {
    // Geometric mean seeds scale b; log-logistic approximation for shape a (p=1 special case is log-logistic); p seeded at 1
    const n = data.length
    const logData = data.map(x => Math.log(x))
    const meanLog = logData.reduce((s, x) => s + x, 0) / n
    const varLog = Math.max(logData.reduce((s, x) => s + (x - meanLog) ** 2, 0) / n, 1e-9)
    const b = Math.exp(meanLog)
    const a = Math.max(Math.PI / Math.sqrt(3 * varLog), 0.1)
    return [1, a, b]
  }
}
