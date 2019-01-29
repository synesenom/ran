import { gamma as fnGamma, gammaLowerIncomplete } from '../special'
import { gamma } from './_standard'
import Distribution from './_distribution'

/**
 * Generator for the [gamma distribution]{@link https://en.wikipedia.org/wiki/Gamma_distribution} using the
 * shape/rate parametrization:
 *
 * $$f(x; \alpha, \beta) = \frac{\beta^\alpha}{\Gamma(\alpha)} x^{\alpha - 1} e^{-\beta x},$$
 *
 * where \(\alpha, \beta \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
 *
 * @class Gamma
 * @memberOf ran.dist
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @param {number=} beta Rate parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (alpha = 1, beta = 1) {
    super('continuous', arguments.length)
    this.p = { alpha, beta }
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: null,
      closed: false
    }]
    this.c = [Math.pow(beta, alpha), fnGamma(alpha)]
  }

  _generator () {
    // Direct sampling
    return gamma(this.p.alpha, this.p.beta)
  }

  _pdf (x) {
    return this.c[0] * Math.exp((this.p.alpha - 1) * Math.log(x) - this.p.beta * x) / this.c[1]
  }

  _cdf (x) {
    return gammaLowerIncomplete(this.p.alpha, this.p.beta * x) / this.c[1]
  }
}
