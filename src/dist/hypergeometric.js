import logBinomial from '../special/log-binomial'
import Categorical from './categorical'
import Distribution from './_distribution'

/**
 * Generator for the [hypergeometric distribution]{@link https://en.wikipedia.org/wiki/Hypergeometric_distribution}:
 *
 * $$f(k; N, K, r) = \frac{\begin{pmatrix}K \\\\ k \\\\ \end{pmatrix} \begin{pmatrix}N - k \\\\ n - k \\\\ \end{pmatrix}}{\begin{pmatrix}N \\\\ n \\\\ \end{pmatrix}},$$
 *
 * with $N \in \mathbb{N}^+$, $K \in \{0, 1, ..., N\}$ and $n \in \{0, 1, ..., N\}$. Support: $k \in \{\mathrm{max}(0, n+K-N), ..., \mathrm{min}(n, K)\}$.
 *
 * @class Hypergeometric
 * @memberof ran.dist
 * @param {number=} N Total number of elements to sample from. If not an integer, it is rounded to the nearest one. Default value is 10.
 * @param {number=} K Total number of successes. If not an integer, it is rounded to the nearest one. Default value is 5.
 * @param {number=} n If not an integer, it is rounded to the nearest one. Number of draws. Default value is 5.
 * @constructor
 */
export default class extends Categorical {
  // Special case of categorical
  constructor (N = 10, K = 5, n = 5) {
    const Ni = Math.round(N)
    const Ki = Math.round(K)
    const ni = Math.round(n)

    const weights = []
    const min = Math.max(0, ni + Ki - Ni)
    const max = Math.min(ni, Ki)
    for (let k = min; k <= max; k++) {
      weights.push(Math.exp(logBinomial(Ki, k) + logBinomial(Ni - Ki, ni - k) - logBinomial(Ni, ni)))
    }
    super(weights)

    // Validate parameters
    Distribution.validate({ N: Ni, K: Ki, n: ni }, [
      'N > 0',
      'K >= 0', 'K <= N',
      'n >= 0', 'n <= N'
    ])
  }
}
