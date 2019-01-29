import { beta, betaIncomplete } from '../special'
import { gamma } from './_standard'
import Distribution from './_distribution'

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
export default class extends Distribution {
  constructor (d1 = 2, d2 = 2) {
    super('continuous', arguments.length)
    this.p = { d1: Math.round(d1), d2: Math.round(d2) }
    this.s = [{
      value: 0,
      closed: this.p.d1 !== 1
    }, {
      value: null,
      closed: false
    }]
    this.c = [beta(this.p.d1 / 2, this.p.d2 / 2), Math.pow(this.p.d2, this.p.d2)]
  }

  _generator () {
    // Direct sampling from gamma
    return this.p.d2 * gamma(this.p.d1 / 2, 1) / (this.p.d1 * gamma(this.p.d2 / 2, 1))
  }

  _pdf (x) {
    return Math.sqrt(Math.pow(this.p.d1 * x, this.p.d1) * this.c[1] / Math.pow(this.p.d1 * x + this.p.d2, this.p.d1 + this.p.d2)) / (x * this.c[0])
  }

  _cdf (x) {
    return betaIncomplete(this.p.d1 / 2, this.p.d2 / 2, this.p.d1 * x / (this.p.d1 * x + this.p.d2))
  }
}
