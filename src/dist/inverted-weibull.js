import Distribution from './_distribution'

/**
 * Generator for the [inverted Weibull distribution]{@link https://docs.scipy.org/doc/scipy/reference/tutorial/stats/continuous_invweibull.html}:
 *
 * $$f(x; c) = c x^{-c - 1} e^{-x^{-c}},$$
 *
 * with $c > 0$. Support: $x \ge 0$.
 *
 * @class InvertedWeibull
 * @memberof ran.dist
 * @param {number=} c Shape parameter. Default value is 2.
 * @constructor
 */
export default class extends Distribution {
  constructor (c = 2) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { c }
    Distribution.validate({ c }, [
      'c > 0'
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
    return this.p.c * Math.pow(x, -1 - this.p.c) * Math.exp(-1 / Math.pow(x, this.p.c))
  }

  _cdf (x) {
    return Math.exp(-1 / Math.pow(x, this.p.c))
  }

  _q (p) {
    return Math.pow(-Math.log(p), -1 / this.p.c)
  }
}
