import { logBinomial, regularizedBetaIncomplete } from '../special'
import Distribution from './_distribution'
import Categorical from './categorical'

/**
 * Probability mass function for the [binomial distribution]{@link https://en.wikipedia.org/wiki/Binomial_distribution}:
 *
 * $f(k; n, p) = \begin{pmatrix}n \\\\ k \\\\ \end{pmatrix} p^k (1 - p)^{n - k},$
 *
 * with $n \in \mathbb{N}_0$ and $p \in \[0, 1\]$. Support: $k \in \{0, ..., n\}$.
 *
 * @class Binomial
 * @memberof ran.dist
 * @constructor
 */
export default class Binomial extends Categorical {
  static _fitInit (data) {
    // E[X] = np; n ≈ max(data) as the support upper bound, p = mean/n.
    const n = Math.max(1, data.reduce((m, x) => x > m ? x : m, 0))
    const p = Math.min(0.99, data.reduce((s, x) => s + x, 0) / (data.length * n))
    return [n, Math.max(0.01, p)]
  }

  /**
   * @param {number} n Number of trials.
   * @param {number} p Probability of success.
   */
  constructor (n, p) {
    const ni = Math.round(n)
    super(Array.from({ length: ni + 1 }, (d, k) => Math.exp(logBinomial(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p))), 0)
    this.p = { n: ni, p }

    // Validate parameters
    Distribution.validate({ n: ni, p }, [
      'n >= 0',
      'p >= 0', 'p <= 1'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: ni,
      closed: true
    }]
  }

  _cdf (x) {
    // solutions/distribution/2026-06-03-0848-binomial-prefix-sum-cdf-quantile-overshoot.md
    // Guard ensures a > 0 in regularizedBetaIncomplete and handles n=0 cleanly
    if (x >= this.p.n) return 1
    return regularizedBetaIncomplete(this.p.n - x, x + 1, 1 - this.p.p)
  }
}
