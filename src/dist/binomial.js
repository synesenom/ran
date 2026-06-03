import { logBinomial, regularizedBetaIncomplete } from '../special'
import Distribution from './_distribution'

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
export default class Binomial extends Distribution {
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
    super('discrete', 2)

    const ni = Math.round(n)
    this.p = { n: ni, p }
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

  _generator () {
    if (this.p.p === 0) return 0
    if (this.p.p === 1) return this.p.n
    let k = 0
    for (let i = 0; i < this.p.n; i++) {
      if (this.r.next() < this.p.p) k++
    }
    return k
  }

  _pdf (x) {
    // Degenerate: n=0 is a point mass at 0; p=0/p=1 force a single outcome
    if (this.p.n === 0 || this.p.p === 0) return x === 0 ? 1 : 0
    if (this.p.p === 1) return x === this.p.n ? 1 : 0
    return Math.exp(logBinomial(this.p.n, x) + x * Math.log(this.p.p) + (this.p.n - x) * Math.log(1 - this.p.p))
  }

  _cdf (x) {
    // solutions/distribution/2026-06-03-0848-binomial-prefix-sum-cdf-quantile-overshoot.md
    // Guard ensures a > 0 in regularizedBetaIncomplete and handles n=0 cleanly
    if (x >= this.p.n) return 1
    return regularizedBetaIncomplete(this.p.n - x, x + 1, 1 - this.p.p)
  }
}
