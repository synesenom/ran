import Categorical from './categorical'
import { logBeta, logBinomial } from '../special'
import Distribution from './_distribution'

/**
 * Probability mass function for the [beta-binomial distribution]{@link https://en.wikipedia.org/wiki/Beta-binomial_distribution}:
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
  static _fitInit (data) {
    // n = max(data); moment-match alpha, beta from mean proportion and overdispersion.
    const n = Math.max(1, data.reduce((m, x) => x > m ? x : m, 0))
    const mean = data.reduce((s, x) => s + x, 0) / data.length
    const variance = data.reduce((s, x) => s + x * x, 0) / data.length - mean * mean
    const m1 = mean / n
    const binVar = n * m1 * (1 - m1)
    const v = binVar > 0 ? Math.max(1.01, variance / binVar) : 2
    const phi = Math.max(0.1, (n - v) / (v - 1))
    return [n, Math.max(0.1, m1 * phi), Math.max(0.1, (1 - m1) * phi)]
  }

  /**
   * @param {number} n Number of trials.
   * @param {number} alpha First shape parameter.
   * @param {number} beta Second shape parameter.
   */
  constructor (n, alpha, beta) {
    const ni = Math.round(n)
    super(Array.from({ length: ni + 1 }, (d, i) => Math.exp(logBinomial(ni, i) + logBeta(i + alpha, ni - i + beta) - logBeta(alpha, beta))), 0)
    this.p = { n: ni, alpha, beta }

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
