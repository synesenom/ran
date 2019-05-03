import Beta from './beta'
import Distribution from './_distribution'

/**
 * Generator for the [PERT distribution]{@link https://en.wikipedia.org/wiki/PERT_distribution}:
 *
 * $$f(x; a, b, c) = \frac{(x - a)^{\alpha - 1} (c - x)^{\beta - 1}}{\mathrm{B}(\alpha, \beta) (c - a)^{\alpha + \beta + 1}},$$
 *
 * where \(a, b, c \in \mathbb{R}\), \(a < b < c\), \(\alpha = \frac{4b + c - 5a}{c - a}\), \(\beta = \frac{5c - a -4b}{c - a}\) and \(\mathrm{B}(x, y)\) is the beta function. Support: \(x \in [a, c]\).
 *
 * @class PERT
 * @memberOf ran.dist
 * @param {number=} a Lower boundary of the support. Default value is 0.
 * @param {number=} b Mode of the distribution. Default value is 0.5.
 * @param {number=} c Upper boundary of the support. Default value is 1.
 * @constructor
 */
export default class extends Beta {
  constructor (a = 0, b = 0.5, c = 1) {
    super((4 * b + c - 5 * a) / (c - a), (5 * c - a - 4 * b) / (c - a))

    // Validate parameters
    this.p = Object.assign(this.p, { a, b, c })
    Distribution._validate({ a, b, c }, [
      'a < b',
      'b < c'
    ])

    // Set support
    this.s = [{
      value: a,
      closed: true
    }, {
      value: c,
      closed: true
    }]
  }

  _generator () {
    // Direct sampling by transforming beta variate
    return super._generator() * (this.p.c - this.p.a) + this.p.a
  }

  _pdf (x) {
    return super._pdf((x - this.p.a) / (this.p.c - this.p.a)) / (this.p.c - this.p.a)
  }

  _cdf (x) {
    return super._cdf((x - this.p.a) / (this.p.c - this.p.a))
  }
}
