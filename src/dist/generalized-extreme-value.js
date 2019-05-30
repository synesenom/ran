import Distribution from './_distribution'

/**
 * Generator for the [generalized extreme value distribution]{@link https://docs.scipy.org/doc/scipy/reference/tutorial/stats/continuous_genextreme.html}:
 *
 * $$f(x; c) = (1 - cx)^{1 / c - 1} e^{-(1 - cx)^{1 / c}},$$
 *
 * with \(c \ne 0\). Support: \(x \in (-\infty, 1 / c]\) if \(c > 0\), \(x \in [1 / c, \infty)\) otherwise.
 *
 * @class GeneralizedExtremeValue
 * @memberOf ran.dist
 * @param {number=} c Shape parameter. Default value is 2.
 * @constructor
 */
export default class extends Distribution {
  constructor (c = 2) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { c }
    Distribution._validate({ c }, [
      'c != 0'
    ])

    // Set support
    this.s = [{
      value: c > 0 ? -Infinity : 1 / c,
      closed: c < 0
    }, {
      value: c > 0 ? 1 / c : Infinity,
      closed: c > 0
    }]
  }

  _generator () {
    return this._q(this.r.next())
  }

  _pdf (x) {
    return Math.exp(-Math.pow(1 - this.p.c * x, 1 / this.p.c)) * Math.pow(1 - this.p.c * x, 1 / this.p.c - 1)
  }

  _cdf (x) {
    return Math.exp(-Math.pow(1 - this.p.c * x, 1 / this.p.c))
  }

  _q (p) {
    return (1 - Math.pow(-Math.log(p), this.p.c)) / this.p.c
  }
}