import Categorical from './categorical'
import { logBeta, logBinomial } from '../special'
import Distribution from './_distribution'

/**
 * Probability function for the [beta-binomial distribution]{@link https://en.wikipedia.org/wiki/Beta-binomial_distribution}:
 *
 * $f(k; n, \alpha, \beta) = \begin{pmatrix}n \\\\ k \\\\ \end{pmatrix} \frac{\mathrm{B}(\alpha + k, \beta + n - k)}{\mathrm{B}(\alpha, \beta)},$
 *
 * with $n \in \mathbb{N}_0$ and $\alpha, \beta > 0$. Support: $k \in \{0, ..., n\}$.
 *
 * @class BetaBinomial
 * @memberof ran.dist
 * @constructor
 */
export default class BetaBinomial extends Categorical {
  // Special case of categorical
  /**
   * @param {number} n Number of trials.
   * @param {number} alpha First shape parameter.
   * @param {number} beta Second shape parameter.
   */
  constructor (n, alpha, beta) {
    const ni = Math.round(n)
    super(Array.from({ length: ni + 1 }, (d, i) => Math.exp(logBinomial(ni, i) + logBeta(i + alpha, ni - i + beta) - logBeta(alpha, beta))), 0)

    // Validate parameters
    Distribution.validate({ n: ni, alpha, beta }, [
      'n >= 0',
      'alpha > 0',
      'beta > 0'
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
}
