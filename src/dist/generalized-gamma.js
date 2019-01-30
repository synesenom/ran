import { gammaLn, gammaLowerIncomplete } from '../special'
import { gamma } from './_standard'
import Distribution from './_distribution'

/**
 * Generator for the [generalized gamma distribution]{@link https://en.wikipedia.org/wiki/Generalized_gamma_distribution}:
 *
 * $$f(x; a, d, p) = \frac{p/a^d}{\Gamma(d/p)} x^{d - 1} e^{-(x/a)^p},$$
 *
 * where \(a, d, p \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
 *
 * @class GeneralizedGamma
 * @memberOf ran.dist
 * @param {number=} a Scale parameter. Default value is 1.
 * @param {number=} d Shape parameter. Default value is 1.
 * @param {number=} p Shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (a = 1, d = 1, p = 1) {
    super('continuous', arguments.length)
    this.p = { a, d, p }
    this.s = [{
      value: 0,
      closed: d >= 1
    }, {
      value: null,
      closed: false
    }]
    this.c = [(p / Math.pow(a, d)), 1 / Math.pow(a, p)]
  }

  _generator () {
    // Direct sampling from gamma
    return Math.pow(gamma(this.p.d / this.p.p, this.c[1]), 1 / this.p.p)
  }

  _pdf (x) {
    return this.c[0] * Math.exp((this.p.d - 1) * Math.log(x) - Math.pow(x / this.p.a, this.p.p) - gammaLn(this.p.d / this.p.p))
  }

  _cdf (x) {
    return gammaLowerIncomplete(this.p.d / this.p.p, Math.pow(x / this.p.a, this.p.p))
  }
}
