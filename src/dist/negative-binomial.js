import { regularizedBetaIncomplete, logBinomial } from '../special'
import gamma from './_gamma'
import poisson from './_poisson'
import Distribution from './_distribution'

/**
 * Generator for the [negative-binomial distribution]{@link https://en.wikipedia.org/wiki/Negative_binomial_distribution}
 * (also known as Gamma-Poisson, Pascal or Pólya distribution):
 *
 * $f(k; r, p) = \begin{pmatrix}k + r - 1 \\\\ k \\\\ \end{pmatrix} (1 - p)^r p^k,$
 *
 * with $r \in \mathbb{N}^+$ and $p \in \[0, 1)$. Support: $k \in \mathbb{N}_0$.
 *
 * @class NegativeBinomial
 * @memberof ran.dist
 * integer.
 * @see https://en.wikipedia.org/wiki/Negative_binomial_distribution
 * @constructor
 */
export default class NegativeBinomial extends Distribution {
  /**
   * @param {number} r Number of failures until the experiment is stopped. If not an integer, it is rounded to the nearest
   * @param {number} p Probability of success.
   */
  constructor (r, p) {
    super('discrete', 2)

    // Validate parameters
    const ri = Math.round(r)
    this.p = { r: ri, p }
    Distribution.validate({ r: ri, p }, [
      'r > 0',
      'p >= 0', 'p < 1'
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
    // p=0 is degenerate: all mass at 0
    if (this.p.p === 0) return 0
    // Direct sampling by compounding Poisson and gamma
    return poisson(this.r, gamma(this.r, this.p.r, 1 / this.p.p - 1))
  }

  _pdf (x) {
    // p=0 is degenerate: point mass at 0
    if (this.p.p === 0) return x === 0 ? 1 : 0
    return Math.exp(logBinomial(x + this.p.r - 1, x) + this.p.r * Math.log(1 - this.p.p) + x * Math.log(this.p.p))
  }

  _cdf (x) {
    // p=0 is degenerate: all mass at 0, so CDF is 1 everywhere on support
    if (this.p.p === 0) return 1
    return 1 - regularizedBetaIncomplete(x + 1, this.p.r, this.p.p)
  }
}
