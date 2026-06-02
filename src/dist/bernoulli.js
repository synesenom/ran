import Categorical from './categorical'
import Distribution from './_distribution'

/**
 * Probability mass function for the [Bernoulli distribution]{@link https://en.wikipedia.org/wiki/Bernoulli_distribution}:
 *
 * $f(k; p) = \begin{cases}p &\quad\text{if $k = 1$},\\\1 - p &\quad\text{if $k = 0$},\\\\\end{cases},$
 *
 * where $p \in \[0, 1\]$. Support: $k \in \\{0, 1\\}$.
 *
 * @class Bernoulli
 * @memberof ran.dist
 * @constructor
 */
export default class Bernoulli extends Categorical {
  // Special case of categorical
  /**
   * @param {number} p Probability of the outcome 1.
   */
  constructor (p) {
    super([1 - p, p], 0)
    this.p = { p }

    // Validate parameter
    Distribution.validate({ p }, [
      'p >= 0',
      'p <= 1'
    ])
  }

  static get _fitInitIsExact () {
    // _fitInit returns the exact closed-form MLE, so fit() skips the optimizer (ADR-0016).
    return true
  }

  static _fitInit (data) {
    // MLE for p is the sample mean since E[X] = p.
    const mean = data.reduce((s, x) => s + x, 0) / data.length
    return [mean]
  }

  _q (p) {
    return p > this.pdfTable[0] ? 1 : 0
  }
}
