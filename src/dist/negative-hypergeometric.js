import logBinomial from '../special/log-binomial'
import Categorical from './categorical'
import Distribution from './_distribution'

/**
 * Generator for the [negative hypergeometric distribution]{@link https://en.wikipedia.org/wiki/Negative_hypergeometric_distribution}:
 *
 * $$f(k; N, K, r) = \frac{\begin{pmatrix}k + r - 1 \\ k \\ \end{pmatrix} \begin{pmatrix}N - r - k \\ K - k \\ \end{pmatrix}}{\begin{pmatrix}N \\ K \\ \end{pmatrix}},$$
 *
 * with \(N \in \mathbb{N}_0\), \(K \in \{0, 1, ..., N\}\) and \(r \in \{0, 1, ..., N - K\}\). Support: \(k \in \{0, ..., K\}\).
 *
 * @class NegativeHypergeometric
 * @memberOf ran.dist
 * @param {number=} N Total number of elements to sample from. If not an integer, it is rounded to the nearest one. Default value is 10.
 * @param {number=} K Total number of successes. If not an integer, it is rounded to the nearest one. Default value is 5.
 * @param {number=} r Total number of failures to stop at. If not an integer, it is rounded to the nearest one. Default value is 5.
 * @constructor
 */
export default class extends Categorical {
  constructor (N = 10, K = 5, r = 5) {
    let Ni = Math.round(N)
    let Ki = Math.round(K)
    let ri = Math.round(r)
    let weights = []
    for (let k = 0; k <= Ki; k++) {
      weights.push(Math.exp(logBinomial(Ki + ri - 1, k) + logBinomial(Ni - ri - k, Ki - k) - logBinomial(Ni, Ki)))
    }
    super(weights)

    // Validate parameters
    Distribution._validate({ N: Ni, K: Ki, r: ri }, [
      'N >= 0',
      'K > 0', 'K <= N',
      'r > 0', 'r <= N - K'
    ])
  }
}
