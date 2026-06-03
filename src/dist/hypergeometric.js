import { logBinomial } from '../special'
import Categorical from './categorical'
import Distribution from './_distribution'

/**
 * Probability mass function for the [hypergeometric distribution]{@link https://en.wikipedia.org/wiki/Hypergeometric_distribution}:
 *
 * $f(k; N, K, n) = \frac{\begin{pmatrix}K \\\\ k \\\\ \end{pmatrix} \begin{pmatrix}N - k \\\\ n - k \\\\ \end{pmatrix}}{\begin{pmatrix}N \\\\ n \\\\ \end{pmatrix}},$
 *
 * with $N \in \mathbb{N}^+$, $K \in \{0, 1, ..., N\}$ and $n \in \{0, 1, ..., N\}$. Support: $k \in \{\mathrm{max}(0, n+K-N), ..., \mathrm{min}(n, K)\}$.
 *
 * @class Hypergeometric
 * @memberof ran.dist
 * @constructor
 */
export default class Hypergeometric extends Categorical {
  static _fitInit (data) {
    // Rough seed: N = 2*max+2 ensures max(data) ≤ min(n, K); E[X] = nK/N seeds K.
    const maxVal = data.reduce((m, x) => x > m ? x : m, 0)
    const mean = data.reduce((s, x) => s + x, 0) / data.length
    const N = 2 * maxVal + 2
    const n = Math.max(1, Math.round(N / 2))
    const K = Math.max(1, Math.min(N - 1, Math.round(mean * N / n)))
    return [N, K, n]
  }

  /**
   * @param {number} N Total number of elements to sample from. If not an integer, it is rounded to the nearest one.
   * @param {number} K Total number of successes. If not an integer, it is rounded to the nearest one.
   * @param {number} n Number of draws. If not an integer, it is rounded to the nearest one.
   */
  constructor (N, K, n) {
    const Ni = Math.round(N)
    const Ki = Math.round(K)
    const ni = Math.round(n)

    const weights = []
    const min = Math.max(0, ni + Ki - Ni)
    const max = Math.min(ni, Ki)
    for (let k = min; k <= max; k++) {
      weights.push(Math.exp(logBinomial(Ki, k) + logBinomial(Ni - Ki, ni - k) - logBinomial(Ni, ni)))
    }
    super(weights, min)
    this.p = { N: Ni, K: Ki, n: ni }

    // Validate parameters
    Distribution.validate({ N: Ni, K: Ki, n: ni }, [
      'N > 0',
      'K >= 0', 'K <= N',
      'n >= 0', 'n <= N'
    ])
  }

  _cdf (x) {
    // Bidirectional raw-PMF summation bypasses AliasTable normalisation bias
    // that causes inherited prefix-sum CDF to fall ~1 ULP below exact boundaries.
    // See solutions/distribution/2026-06-03-1300-categorical-subclass-bidirectional-cdf-quantile-overshoot.md
    const { N, K, n } = this.p
    const lo = Math.max(0, n + K - N)
    const hi = Math.min(n, K)
    if (x >= hi) return 1
    const logBinNn = logBinomial(N, n)
    let fwd = 0
    for (let k = lo; k <= x; k++) {
      fwd += Math.exp(logBinomial(K, k) + logBinomial(N - K, n - k) - logBinNn)
    }
    let bwd = 0
    for (let k = hi; k > x; k--) {
      bwd += Math.exp(logBinomial(K, k) + logBinomial(N - K, n - k) - logBinNn)
    }
    return Math.min(1, Math.max(fwd, 1 - bwd))
  }
}
