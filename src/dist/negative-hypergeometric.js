import { logBinomial } from '../special'
import Categorical from './categorical'
import Distribution from './_distribution'

/**
 * Probability mass function for the [negative hypergeometric distribution]{@link https://en.wikipedia.org/wiki/Negative_hypergeometric_distribution}:
 *
 * $f(k; N, K, r) = \frac{\begin{pmatrix}k + r - 1 \\\\ k \\\\ \end{pmatrix} \begin{pmatrix}N - r - k \\\\ K - k \\\\ \end{pmatrix}}{\begin{pmatrix}N \\\\ K \\\\ \end{pmatrix}},$
 *
 * with $N \in \mathbb{N}_0$, $K \in \{0, 1, ..., N\}$ and $r \in \{0, 1, ..., N - K\}$. Support: $k \in \{0, ..., K\}$.
 *
 * @class NegativeHypergeometric
 * @memberof ran.dist
 * @constructor
 */
export default class NegativeHypergeometric extends Categorical {
  static _fitInit (data) {
    // Rough seed: N = 2*max+2, K = N/2, r = 1; Nelder-Mead refines from this.
    const maxVal = data.reduce((m, x) => x > m ? x : m, 0)
    const N = 2 * maxVal + 2
    const K = Math.max(1, Math.round(N / 2))
    return [N, K, 1]
  }

  /**
   * @param {number} N Total number of elements to sample from. If not an integer, it is rounded to the nearest one.
   * @param {number} K Total number of successes. If not an integer, it is rounded to the nearest one.
   * @param {number} r Total number of failures to stop at. If not an integer, it is rounded to the nearest one.
   */
  constructor (N, K, r) {
    // Validate parameters
    const Ni = Math.round(N)
    const Ki = Math.round(K)
    const ri = Math.round(r)
    Distribution.validate({ N: Ni, K: Ki, r: ri, 'N - K': Ni - Ki }, [
      'N >= 0',
      'K > 0', 'K <= N',
      'r > 0', 'r <= N - K'
    ])

    // Build weights
    const weights = []
    for (let k = 0; k <= Ki; k++) {
      weights.push(Math.exp(logBinomial(k + ri - 1, k) + logBinomial(Ni - ri - k, Ki - k) - logBinomial(Ni, Ki)))
    }
    super(weights, 0)
    this.p = { N: Ni, K: Ki, r: ri }
  }
}
