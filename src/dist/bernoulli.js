import Categorical from './categorical'
import Distribution from './_distribution'

/**
 * Generator for the [Bernoulli distribution]{@link https://en.wikipedia.org/wiki/Bernoulli_distribution}:
 *
 * $$f(k; p) = \begin{cases}p &\quad\text{if $k = 1$},\\1 - p &\quad\text{if $k = 0$},\\\end{cases}$$
 *
 * where \(p \in [0, 1]\). Support: \(k \in \{0, 1\}\).
 *
 * @class Bernoulli
 * @memberof ran.dist
 * @param {number=} p Probability of the outcome 1. Default value is 0.5.
 * @constructor
 */
export default class extends Categorical {
  // Special case of categorical
  constructor (p = 0.5) {
    super([1 - p, p])

    // Validate parameter
    Distribution.validate({ p }, [
      'p >= 0',
      'p <= 1'
    ])
  }

  _q (p) {
    return p > 1 - this.p.p ? 1 : 0
  }
}
