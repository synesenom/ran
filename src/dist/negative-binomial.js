import logBinomial from '../special/log-binomial'
import { regularizedBetaIncomplete } from '../special/beta-incomplete'
import { gamma, poisson } from './_core'
import Distribution from './_distribution'

/**
 * Generator for the [negative-binomial distribution]{@link https://en.wikipedia.org/wiki/Negative_binomial_distribution}
 * (also known as Gamma-Poisson, Pascal or Pólya distribution):
 *
 * $$f(k; r, p) = \begin{pmatrix}k + r - 1 \\ k \\ \end{pmatrix} (1 - p)^r p^k,$$
 *
 * with \(r \in \mathbb{N}^+\) and \(p \in [0, 1]\). Support: \(k \in \mathbb{N}_0\).
 *
 * @class NegativeBinomial
 * @memberOf ran.dist
 * @param {number=} r Number of failures until the experiment is stopped. If not an integer, it is rounded to the nearest
 * integer. Default value is 10.
 * @param {number=} p Probability of success. Default value is 0.5.
 * @constructor
 */
export default class extends Distribution {
  constructor (r = 10, p = 0.5) {
    super('discrete', arguments.length)

    // Validate parameters
    const ri = Math.round(r)
    this.p = { r: ri, p }
    Distribution._validate({ r: ri, p }, [
      'r > 0',
      'p > 0', 'p < 1'
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
    // TODO Make this a core generator
    // Direct sampling by compounding Poisson and gamma
    return poisson(this.r, gamma(this.r, this.p.r, 1 / this.p.p - 1))
  }

  _pdf (x) {
    return Math.exp(logBinomial(x + this.p.r - 1, x) + this.p.r * Math.log(1 - this.p.p) + x * Math.log(this.p.p))
  }

  _cdf (x) {
    return 1 - regularizedBetaIncomplete(x + 1, this.p.r, this.p.p)
  }
}
