import Beta from './beta'

/**
 * Generator for the [F distribution]{@link https://en.wikipedia.org/wiki/F-distribution} (or Fisher-Snedecor's F
 * distribution):
 *
 * $$f(x; d_1, d_2) = \frac{\sqrt{\frac{(d_1 x)^{d_1} d_2^{d_2}}{(d_1x + d_2)^{d_1 + d_2}}}}{x \mathrm{B}\big(\frac{d_1}{2}, \frac{d_2}{2}\big)},$$
 *
 * with \(d_1, d_2 \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
 *
 * @class F
 * @memberOf ran.dist
 * @param {number=} d1 First degree of freedom. Default value is 2.
 * @param {number=} d2 Second degree of freedom. Default value is 2.
 * @constructor
 */
export default class extends Beta {
  // Transformation of beta distribution
  constructor (d1 = 2, d2 = 2) {
    super(d1 / 2, d2 / 2)
    this.p = Object.assign({ d1, d2 }, this.p)
    this.s = [{
      value: 0,
      closed: d1 !== 1
    }, {
      value: Infinity,
      closed: false
    }]
    this.mode = d2 > 2 ? (d2 - 2) * d2 / (d1 * (d2 + 2)) : 0
  }

  _generator () {
    // Direct sampling by transforming beta variate
    let x = super._generator()
    return this.p.d2 * x / (this.p.d1 * (1 - x))
  }

  _pdf (x) {
    return this.p.d1 * this.p.d2 * super._pdf(this.p.d1 * x / (this.p.d2 + this.p.d1 * x)) / Math.pow(this.p.d2 + this.p.d1 * x, 2)
  }

  _cdf (x) {
    let y = this.p.d1 * x
    return super._cdf( 1 / (1 + this.p.d2 / y))
  }
}
