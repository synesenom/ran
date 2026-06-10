import Distribution from './_distribution'

/**
 * Probability density function for the [Burr (XII) distribution]{@link https://en.wikipedia.org/wiki/Burr_distribution} (also known as
 * Singh-Maddala distribution):
 *
 * $f(x; c, k) = c k \frac{x^{c - 1}}{(1 + x^c)^{k + 1}},$
 *
 * with $c, k > 0$. Support: $x > 0$.
 *
 * Cumulative distribution function:
 *
 * $F(x; c, k) = 1 - (1 + x^c)^{-k}$
 *
 * @class Burr
 * @memberof ran.dist
 * @constructor
 */
export default class Burr extends Distribution {
  /**
   * @param {number} c First shape parameter.
   * @param {number} k Second shape parameter.
   */
  constructor (c, k) {
    super('continuous', 2)

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
    this.c = {
      ck: c * k,
      negInvK: -1 / k,
      invC: 1 / c
    }
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const y = Math.pow(x, this.p.c)
    return this.c.ck * y / (x * Math.pow(1 + y, this.p.k + 1))
  }

  _cdf (x) {
    // -expm1(-k * log1p(x^c)) avoids cancellation when x^c is near 0
    return -Math.expm1(-this.p.k * Math.log1p(Math.pow(x, this.p.c)))
  }

  _q (p) {
    return Math.pow(Math.pow(1 - p, this.c.negInvK) - 1, this.c.invC)
  }

  static _fitInit (data) {
    // log-scale variance gives c via log-logistic approximation; E[log(1+x^c)]=1/k (Exp identity) gives k
    const n = data.length
    const logData = data.map(x => Math.log(x))
    const meanLog = logData.reduce((s, x) => s + x, 0) / n
    const varLog = Math.max(logData.reduce((s, x) => s + (x - meanLog) ** 2, 0) / n, 1e-9)
    const c = Math.max(Math.PI / Math.sqrt(3 * varLog), 0.1)
    const k = Math.max(n / Math.max(data.reduce((s, x) => s + Math.log1p(Math.pow(x, c)), 0), 1e-9), 0.1)
    return [c, k]
  }
}
