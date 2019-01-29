import { binomLn } from '../special'
import Custom from './custom'

/**
 * Generator for the [hypergeometric distribution]{@link https://en.wikipedia.org/wiki/Negative_hypergeometric_distribution}:
 *
 * $$f(k; N, K, r) = \frac{\begin{pmatrix}K \\ k \\ \end{pmatrix} \begin{pmatrix}N - k \\ n - k \\ \end{pmatrix}}{\begin{pmatrix}N \\ n \\ \end{pmatrix}},$$
 *
 * with \(N \in \mathbb{N}_0\), \(K \in \{0, 1, ..., N\}\) and \(n \in \{0, 1, ..., N\}\). Support: \(k \in \{\mathrm{max}(0, n+K-N), ..., \mathrm{min}(n, K)\}\).
 *
 * @class Hypergeometric
 * @memberOf ran.dist
 * @param {number=} N Total number of elements to sample from. Default value is 10.
 * @param {number=} K Total number of successes. Default value is 5.
 * @param {number=} n Number of draws.
 * @constructor
 */
export default class extends Custom {
  constructor (N = 10, K = 5, n = 5) {
    let weights = []
    let min = Math.max(0, n + K - N)
    let max = Math.min(n, K)
    for (let k = min; k <= max; k++) {
      weights.push(Math.exp(binomLn(K, k) + binomLn(N - K, n - k) - binomLn(N, n)))
    }
    super(weights)
  }
}
