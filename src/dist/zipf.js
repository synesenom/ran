import Categorical from './categorical'
import Distribution from './_distribution'

/**
 * Generator for the [Zipf distribution]{@link https://en.wikipedia.org/wiki/Zipf%27s_law}:
 *
 * $f(k; s, N) = \frac{k^{-s}}{H_{N, s}},$
 *
 * with $s \ge 0$, $N \in \mathbb{N}^+$ and $H_{N, s}$ denotes the generalized harmonic number. Support: $k \in \{1, 2, ..., N\}$.
 *
 * @class Zipf
 * @memberof ran.dist
 * @see https://en.wikipedia.org/wiki/Zipf%27s_law
 * @constructor
 */
export default class Zipf extends Categorical {
  // Special case of categorical
  /**
   * @param {number} s Exponent of the distribution.
   * @param {number} N Number of words. If not an integer, it is rounded to the nearest integer. Default is 100.
   */
  constructor (s, N) {
    const Ni = Math.round(N)
    super(Array.from({ length: Ni }, (d, i) => Math.pow(i + 1, -s)), 1)

    // Validate parameters
    Distribution.validate({ s, N: Ni }, [
      's >= 0',
      'N > 0'
    ])
  }
}
