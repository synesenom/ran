import Beta from './beta'

/**
 * Generator for the [F distribution]{@link https://en.wikipedia.org/wiki/F-distribution} (or Fisher-Snedecor's F
 * distribution):
 *
 * $$f(x; d_1, d_2) = \frac{\sqrt{\frac{(d_1 x)^{d_1} d_2^{d_2}}{(d_1x + d_2)^{d_1 + d_2}}}}{x \mathrm{B}\big(\frac{d_1}{2}, \frac{d_2}{2}\big)},$$
 *
 * with \(d_1, d_2 > 0\). Support: \(x > 0\).
 *
 * @class F
 * @memberOf ran.dist
 * @param {number=} d1 First degree of freedom. If not an integer, it is rounded to the nearest one. Default value is 2.
 * @param {number=} d2 Second degree of freedom. If not an integer, it is rounded to the nearest one. Default value is 2.
 * @constructor
 */
export default class extends Beta {
  // Transformation of beta distribution
  constructor (d1 = 2, d2 = 2) {
    let d1i = Math.round(d1)
    let d2i = Math.round(d2)
    super(d1i / 2, d2i / 2)

    // Validate parameters
    this.p = Object.assign(this.p, { d1: d1i, d2: d2i })
    Distribution._validate({ d1: d1i, d2: d2i }, [
      'd1 > 0',
      'd2 > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: d1i !== 1
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling by transforming beta variate
    let x = super._generator()
    return this.p.d2 * x / (this.p.d1 * (1 - x))
  }

  _pdf (x) {
    let y = this.p.d2 + this.p.d1 * x
    return this.p.d1 * this.p.d2 * super._pdf(this.p.d1 * x / y) / Math.pow(y, 2)
  }

  _cdf (x) {
    let y = this.p.d1 * x
    return super._cdf( 1 / (1 + this.p.d2 / y))
  }
}
