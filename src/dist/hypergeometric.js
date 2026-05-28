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
    super(weights, 0)

    // Validate parameters
    Distribution.validate({ N: Ni, K: Ki, n: ni }, [
      'N > 0',
      'K >= 0', 'K <= N',
      'n >= 0', 'n <= N'
    ])
  }
}
