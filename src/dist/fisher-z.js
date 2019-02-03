import F from './f'

/**
 * Generator for [Fisher's z distribution]{@link https://en.wikipedia.org/wiki/Fisher%27s_z-distribution}:
 *
 * $$f(x; d_1, d_2) = \frac{2 d_1^{d_1 / 2} d_2^{d_2 / 2}}{\mathrm{B}(d_1 / 2, d_2 / 2)} \frac{e^{d_1 x}}{(d_1 e^{2 x} + d_2)^{(d_1 + d2) / 2}},$$
 *
 * with \(d_1, d_2 \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}\).
 *
 * @class FisherZ
 * @memberOf ran.dist
 * @param {number=} d1 First degree of freedom. Default value is 2.
 * @param {number=} d2 Second degree of freedom. Default value is 2.
 * @constructor
 */
export default class extends F {
  // Transforming F variate
  constructor (d1 = 1, d2 = 1) {
    super(d1, d2)
    this.s = [{
      value: null,
      closed: false
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling by transforming F variate
    return 0.5 * Math.log(super._generator())
  }

  _pdf (x) {
    return super._pdf(Math.exp(2 * x)) * 2 * Math.exp(2 * x)
  }

  _cdf (x) {
    return super._cdf(Math.exp(2 * x))
  }
}
