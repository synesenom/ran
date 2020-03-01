import Categorical from './categorical'
import logBeta from '../special/log-beta'
import logBinomial from '../special/log-binomial'
import Distribution from './_distribution'

/**
 * Generator for the [beta-binomial distribution]{@link https://en.wikipedia.org/wiki/Beta-binomial_distribution}:
 *
 * $$f(k; n, \alpha, \beta) = \begin{pmatrix}n \\ k \\ \end{pmatrix} \frac{\mathrm{B}(\alpha + k, \beta + n - k)}{\mathrm{B}(\alpha, \beta)},$$
 *
 * with \(n \in \mathbb{N}_0\) and \(\alpha, \beta > 0\). Support: \(k \in \{0, ..., n\}\).
 *
 * @class BetaBinomial
 * @memberOf ran.dist
 * @param {number=} n Number of trials. Default value is 10.
 * @param {number=} alpha First shape parameter. Default value is 1.
 * @param {number=} beta Second shape parameter. Default value is 2.
 * @constructor
 */
export default class extends Categorical {
  // Special case of categorical
  constructor (n = 10, alpha = 1, beta = 2) {
    const ni = Math.round(n)
    super(Array.from({ length: ni + 1 }, (d, i) => Math.exp(logBinomial(ni, i) + logBeta(i + alpha, ni - i + beta) - logBeta(alpha, beta))))

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
