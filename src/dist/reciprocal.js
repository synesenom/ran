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

  static _fitInit (data) {
    // Log-uniform: support bounds are observed range; clamp a away from zero to satisfy a>0
    const a = Math.max(Math.min(...data), 1e-8)
    const b = Math.max(...data)
    return [a, b > a ? b : a * 10]
  }

  _generator () {
    // Direct sampling
    return this.p.a * Math.exp((this.c.logB - this.c.logA) * this.r.next())
  }

  _pdf (x) {
    return 1 / (x * (this.c.logB - this.c.logA))
  }

  _cdf (x) {
    return (Math.log(x) - this.c.logA) / (this.c.logB - this.c.logA)
  }
}
