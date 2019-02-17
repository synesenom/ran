import { gammaLn, gammaLowerIncomplete } from '../special'
import { poisson } from './_core'
import Distribution from './_distribution'

/**
 * Generator for the [Poisson distribution]{@link https://en.wikipedia.org/wiki/Poisson_distribution}:
 *
 * $$f(k; \lambda) = \frac{\lambda^k e^{-\lambda}}{k!},$$
 *
 * with \(\lambda \in \mathbb{R}^+\). Support: \(k \in \mathbb{N}_0\).
 *
 * @class Poisson
 * @memberOf ran.dist
 * @param {number=} lambda Mean of the distribution. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (lambda = 1) {
    super('discrete', arguments.length)
    this.p = { lambda }
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    return poisson(this.p.lambda)
  }

  _pdf (x) {
    return Math.pow(this.p.lambda, x) * Math.exp(-this.p.lambda - gammaLn(x + 1))
  }

  _cdf (x) {
    return 1 - gammaLowerIncomplete(x + 1, this.p.lambda)
  }
}
