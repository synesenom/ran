import logGamma from '../special/log-gamma'
import { gammaLowerIncomplete } from '../special/gamma-incomplete'
import { poisson } from './_core'
import Distribution from './_distribution'

/**
 * Generator for the [Poisson distribution]{@link https://en.wikipedia.org/wiki/Poisson_distribution}:
 *
 * $$f(k; \lambda) = \frac{\lambda^k e^{-\lambda}}{k!},$$
 *
 * with \(\lambda > 0\). Support: \(k \in \mathbb{N}_0\).
 *
 * @class Poisson
 * @memberof ran.dist
 * @param {number=} lambda Mean of the distribution. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (lambda = 1) {
    super('discrete', arguments.length)

    // Validate parameters
    this.p = { lambda }
    Distribution.validate({ lambda }, [
      'lambda > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    return poisson(this.r, this.p.lambda)
  }

  _pdf (x) {
    return Math.exp(x * Math.log(this.p.lambda) - this.p.lambda - logGamma(x + 1))
  }

  _cdf (x) {
    return 1 - gammaLowerIncomplete(x + 1, this.p.lambda)
  }
}
