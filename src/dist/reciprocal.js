import Distribution from './_distribution'

/**
 * Probability density function for the [reciprocal distribution]{@link https://en.wikipedia.org/wiki/Reciprocal_distribution}:
 *
 * $f(x; a, b) = \frac{1}{x \[\ln b - \ln a\]},$
 *
 * with $a, b > 0$ and $a < b$. Support: $x \in \[a, b\]$.
 *
 * @class Reciprocal
 * @memberof ran.dist
 * @constructor
 */
export default class Reciprocal extends Distribution {
  /**
   * @param {number} a Lower boundary of the support.
   * @param {number} b Upper boundary of the support.
   */
  constructor (a, b) {
    super('continuous', 2)

    // Validate parameters
    this.p = { a, b }
    Distribution.validate({ a, b }, [
      'a > 0',
      'b > 0',
      'a < b'
    ])

    // Set support
    this.s = [{
      value: a,
      closed: true
    }, {
      value: b,
      closed: true
    }]

    // Speed-up constants
    this.c = {
      logA: Math.log(a),
      logB: Math.log(b)
    }
  }

  static get _fitInitIsExact () {
    // _fitInit returns the exact closed-form MLE, so fit() skips the optimizer (ADR-0016).
    return true
  }

  static _fitInit (data) {
    // Log-uniform: support bounds are observed range; clamp a away from zero to satisfy a>0
    const a = Math.max(Math.min(...data), 1e-8)
    const b = Math.max(...data)
    return [a, b > a ? b : a * 10]
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    const L = this.c.logB - this.c.logA
    return (this.p.b - this.p.a) / L
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const L = this.c.logB - this.c.logA
    const { a, b } = this.p
    const mu = this.mean()
    return (b * b - a * a) / (2 * L) - mu * mu
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const L = this.c.logB - this.c.logA
    const { a, b } = this.p
    const mu = this.mean()
    const sigma2 = this.variance()
    const e2 = (b * b - a * a) / (2 * L)
    const e3 = (b * b * b - a * a * a) / (3 * L)
    const mu3 = e3 - 3 * mu * e2 + 2 * mu * mu * mu
    return mu3 / Math.pow(sigma2, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const L = this.c.logB - this.c.logA
    const { a, b } = this.p
    const mu = this.mean()
    const sigma2 = this.variance()
    const e2 = (b * b - a * a) / (2 * L)
    const e3 = (b * b * b - a * a * a) / (3 * L)
    const e4 = (b * b * b * b - a * a * a * a) / (4 * L)
    const mu4 = e4 - 4 * mu * e3 + 6 * mu * mu * e2 - 3 * mu * mu * mu * mu
    return mu4 / (sigma2 * sigma2) - 3
  }

  _generator () {
    // Inverse transform sampling: q(u) for u ~ U(0,1).
    return this._q(this.r.next())
  }

  _pdf (x) {
    return 1 / (x * (this.c.logB - this.c.logA))
  }

  _cdf (x) {
    return (Math.log(x) - this.c.logA) / (this.c.logB - this.c.logA)
  }

  _q (p) {
    // Log-uniform CDF is linear in log x, so it inverts directly: x = a (b/a)^p
    return this.p.a * Math.exp((this.c.logB - this.c.logA) * p)
  }
}
