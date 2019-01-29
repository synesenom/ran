import { binomLn } from '../special'
import Custom from './custom'

/**
 * Generator for the [negative hypergeometric distribution]{@link https://en.wikipedia.org/wiki/Negative_hypergeometric_distribution}:
 *
 * $$f(k; N, K, r) = \frac{\begin{pmatrix}k + r - 1 \\ k \\ \end{pmatrix} \begin{pmatrix}N - r - k \\ K - k \\ \end{pmatrix}}{\begin{pmatrix}N \\ K \\ \end{pmatrix}},$$
 *
 * with \(N \in \mathbb{N}_0\), \(K \in \{0, 1, ..., N\}\) and \(r \in \{0, 1, ..., K - N\}\). Support: \(k \in \{0, ..., K\}\).
 *
 * @class NegativeHypergeometric
 * @memberOf ran.dist
 * @param {number=} N Total number of elements to sample from. Default value is 10.
 * @param {number=} K Total number of successes. Default value is 5.
 * @param {number=} r Total number of failures to stop at. Default value is 5.
 * @constructor
 */
export default class extends Custom {
  constructor (N = 10, K = 5, r = 5) {
    let weights = []
    for (let k = 0; k <= K; k++) {
      weights.push(Math.exp(binomLn(K + r - 1, k) + binomLn(N - r - k, K - k) - binomLn(N, K)))
    }
    super(weights)
  }
}
