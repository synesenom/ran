import Categorical from './categorical'

/**
 * Generator for the [Rademacher distribution]{@link https://en.wikipedia.org/wiki/Rademacher_distribution}:
 *
 * $$f(k) = \begin{cases}1/2 &\quad\text{if $k = -1$},\\\\ 1/2 &\quad\text{if $k = 1$},\\\\ 0 &\quad\text{otherwise}.\\\\ \end{cases}$$
 *
 * Support: $k \in \{-1, 1\}$.
 *
 * @class Rademacher
 * @memberof ran.dist
 * @constructor
 */
export default class extends Categorical {
  // Special case of categorical
  constructor () {
    super([0.5, 0, 0.5], -1)
  }

  _q (p) {
    return p > 0.5 ? 1 : -1
  }
}
