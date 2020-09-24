import F from './f'

/**
 * Generator for [Fisher's z distribution]{@link https://en.wikipedia.org/wiki/Fisher%27s_z-distribution}:
 *
 * $$f(x; d_1, d_2) = \sqrt{\frac{d_1^{d_1} d_2^{d_2}}{(d_1 e^{2 x} + d_2)^{d_1 + d_2}}} \frac{2 e^{d_1 x}}{\mathrm{B}\big(\frac{d_1}{2}, \frac{d_2}{2}\big)},$$
 *
 * with \(d_1, d_2 > 0\). Support: \(x \in \mathbb{R}\).
 *
 * @class FisherZ
 * @memberof ran.dist
 * @param {number=} d1 First degree of freedom. Default value is 2.
 * @param {number=} d2 Second degree of freedom. Default value is 2.
 * @constructor
 */
export default class extends F {
  // Transformation of F
  constructor (d1 = 1, d2 = 1) {
    const d1i = Math.round(d1)
    const d2i = Math.round(d2)
    super(d1i / 2, d2i / 2)

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling by transforming F variate
    return 0.5 * Math.log(super._generator())
  }

  _pdf (x) {
    const y = Math.exp(2 * x)
    return super._pdf(y) * 2 * y
  }

  _cdf (x) {
    return super._cdf(Math.exp(2 * x))
  }
}
