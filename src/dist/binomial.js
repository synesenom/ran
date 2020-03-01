import logBinomial from '../special/log-binomial'
import Distribution from './_distribution'
import Categorical from './categorical'

/**
 * Generator for the [binomial distribution]{@link https://en.wikipedia.org/wiki/Binomial_distribution}:
 *
 * $$f(k; n, p) = \begin{pmatrix}n \\ k \\ \end{pmatrix} p^k (1 - p)^{n - k},$$
 *
 * with \(n \in \mathbb{N}_0\) and \(p \in [0, 1]\). Support: \(k \in \{0, ..., n\}\).
 *
 * @class Binomial
 * @memberOf ran.dist
 * @param {number=} n Number of trials. Default value is 100.
 * @param {number=} p Probability of success. Default value is 0.5.
 * @constructor
 */
export default class extends Categorical {
  // Special case of categorical
  constructor (n = 100, p = 0.5) {
    const ni = Math.round(n)
    super(Array.from({ length: ni + 1 }, (d, k) => Math.exp(logBinomial(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p))))

    // Validate parameters
    Distribution.validate({ n: ni, p }, [
      'n >= 0',
      'p >= 0', 'p <= 1'
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
