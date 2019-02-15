import { gammaLn, gammaLowerIncomplete } from '../special'
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
      closed: alpha >= 1
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling
    return gamma(this.p.alpha, this.p.beta)
  }

  _pdf (x) {
    return Math.exp(this.p.alpha * Math.log(this.p.beta) - this.p.beta * x - gammaLn(this.p.alpha)) * Math.pow(x, this.p.alpha - 1)
  }

  _cdf (x) {
    return gammaLowerIncomplete(this.p.alpha, this.p.beta * x)
  }
}
