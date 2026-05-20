import { gammaLowerIncomplete, logGamma } from '../special'
import gamma from './_gamma'
import Distribution from './_distribution'

/**
 * Generator for the [gamma distribution]{@link https://en.wikipedia.org/wiki/Gamma_distribution} using the
 * shape/rate parametrization:
 *
 * $$f(x; \alpha, \beta) = \frac{\beta^\alpha}{\Gamma(\alpha)} x^{\alpha - 1} e^{-\beta x},$$
 *
 * where $\alpha, \beta > 0$. Support: $x > 0$.
 *
 * @class Gamma
 * @memberof ran.dist
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @param {number=} beta Rate parameter. Default value is 1.
 * @see https://en.wikipedia.org/wiki/Gamma_distribution
 * @see G. Marsaglia and W. W. Tsang, "A Simple Method for Generating Gamma Variables", ACM Trans. Math. Softw. 26(3), 363–372, 2000.
 * @constructor
 */
export default class extends Distribution {
  constructor (alpha, beta) {
    super('continuous', 2)

    // Validate parameters
    this.p = { alpha, beta }
    Distribution.validate({ alpha, beta }, [
      'alpha > 0',
      'beta > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: alpha >= 1
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling
    return gamma(this.r, this.p.alpha, this.p.beta)
  }

  _pdf (x) {
    return Math.exp(this.p.alpha * Math.log(this.p.beta) - this.p.beta * x - logGamma(this.p.alpha)) * Math.pow(x, this.p.alpha - 1)
  }

  _cdf (x) {
    return gammaLowerIncomplete(this.p.alpha, this.p.beta * x)
  }
}
