import binomLn from '../special/binom-log'
import Custom from './categorical'

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
    let Ni = Math.round(N)
    let Ki = Math.round(K)
    let ri = Math.round(r)
    let weights = []
    for (let k = 0; k <= Ki; k++) {
      weights.push(Math.exp(binomLn(Ki + ri - 1, k) + binomLn(Ni - ri - k, Ki - k) - binomLn(Ni, Ki)))
    }
    super(weights)
  }
}
