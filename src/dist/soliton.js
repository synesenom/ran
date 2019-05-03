import Categorical from './categorical'

/**
 * Generator for the (ideal) [soliton distribution]{@link https://en.wikipedia.org/wiki/Soliton_distribution}:
 *
 * $$f(k; N) = \begin{cases}\frac{1}{N} &\quad\text{if $k = 1$},\\\frac{1}{k (1 - k)} &\quad\text{otherwise}\\\end{cases},$$
 *
 * with \(N \in \mathbb{N}^+\). Support: \(k \in \{1, 2, ..., N\}\).
 *
 * @class Soliton
 * @memberOf ran.dist
 * @param {number=} N Number of blocks in the messaging model. If not an integer, it is rounded to the nearest one. Default value is 1.
 * @constructor
 */
export default class extends Categorical {
  // Special case of custom
  constructor (N = 10) {
    // Define weights
    let Ni = Math.round(N)
    super([1 / Ni].concat(Array.from({ length: Ni - 2 }, (d, i) => 1 / ((i + 1) * (i + 2)))), 1)

    // Validate parameters
    Distribution._validate({ N: Ni }, [
      'N > 0'
    ])
  }
}
