import { beta, betaIncomplete } from '../special'
import { gamma } from './_standard'
import Distribution from './_distribution'

/**
 * Generator for [Fisher's z distribution]{@link https://en.wikipedia.org/wiki/Fisher%27s_z-distribution}:
 *
 * $$f(x; d_1, d_2) = \frac{2 d_1^{d_1 / 2} d_2^{d_2 / 2}}{\mathrm{B}(d_1 / 2, d_2 / 2)} \frac{e^{d_1 x}}{(d_1 e^{2 x} + d_2)^{(d_1 + d2) / 2}},$$
 *
 * with \(d_1, d_2 \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}\).
 *
 * @class FishersZ
 * @memberOf ran.dist
 * @param {number=} d1 First degree of freedom. Default value is 2.
 * @param {number=} d2 Second degree of freedom. Default value is 2.
 * @constructor
 */
export default class extends Distribution {
  constructor (d1 = 1, d2 = 1) {
    super('continuous', arguments.length)
    this.p = { d1, d2 }
    this.s = [{
      value: null,
      closed: false
    }, {
      value: null,
      closed: false
    }]
    this.c = [beta(d1 / 2, d2 / 2), Math.pow(d2, d2)]
  }

  _generator () {
    // Direct sampling by transforming F variate
    let f = this.p.d2 * gamma(this.p.d1 / 2, 1) / (this.p.d1 * gamma(this.p.d2 / 2, 1))
    return 0.5 * Math.log(f)
  }

  _pdf (x) {
    let y = Math.exp(2 * x)
    return 2 * Math.pow(this.p.d1, this.p.d1 / 2) * Math.pow(this.p.d2, this.p.d2 / 2) * Math.exp(this.p.d1 * x) / (beta(this.p.d1 / 2, this.p.d2 / 2) * Math.pow(this.p.d1 * y + this.p.d2, 0.5 * (this.p.d1 + this.p.d2)))
  }

  _cdf (x) {
    let y = Math.exp(2 * x)
    return betaIncomplete(this.p.d1 / 2, this.p.d2 / 2, this.p.d1 * y / (this.p.d1 * y + this.p.d2))
  }
}
