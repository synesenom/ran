import { gammaLn, gammaLowerIncomplete } from '../special'
import { gamma } from './_standard'
import Distribution from './_distribution'

/**
 * Generator for the [\(\chi\) distribution]{@link https://en.wikipedia.org/wiki/Chi_distribution}:
 *
 * $$f(x; k) = \frac{1}{2^{k/2 - 1} \Gamma(k/2)} x^{k - 1} e^{-x^2/2},$$
 *
 * where \(k \in \mathbb{N}^+\). Support: \(x \in \mathbb{R}^+\).
 *
 * @class Chi
 * @memberOf ran.dist
 * @param {number=} k Degrees of freedom. If not an integer, is rounded to the nearest one. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (k = 1) {
    super('continuous', arguments.length)
    this.p = { k: Math.round(k) }
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: null,
      closed: false
    }]
    this.c = [(this.p.k / 2 - 1) * Math.LN2]
  }

  _generator () {
    // Direct sampling from gamma
    return Math.sqrt(gamma(this.p.k / 2, 0.5))
  }

  _pdf (x) {
    return Math.exp((this.p.k - 1) * Math.log(x) - 0.5 * x * x - gammaLn(this.p.k / 2) - this.c[0])
  }

  _cdf (x) {
    return gammaLowerIncomplete(this.p.k / 2, x * x / 2)
  }
}
