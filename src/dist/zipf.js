import Categorical from './categorical'
import Distribution from './_distribution'

/**
 * Generator for the [Zipf distribution]{@link https://en.wikipedia.org/wiki/Zipf%27s_law}:
 *
 * $$f(k; s, N) = \frac{k^{-s}}{H_{N, s}},$$
 *
 * with \(s \ge 0\), \(N \in \mathbb{N}^+\) and \(H_{N, s}\) denotes the generalized harmonic number. Support: \(k \in \{1, 2, ..., N\}\).
 *
 * @class Zipf
 * @memberOf ran.dist
 * @param {number=} s Exponent of the distribution. Default value is 1.
 * @param {number=} N Number of words. If not an integer, it is rounded to the nearest integer. Default is 100.
 * @constructor
 */
export default class extends Categorical {
  // Special case of categorical
  constructor (s = 1, N = 100) {
    let Ni = Math.round(N)
    super(Array.from({ length: Ni }, (d, i) => Math.pow(i + 1, -s)), 1)

    // Validate parameters
    Distribution._validate({ s, N: Ni }, [
      's >= 0',
      'N > 0'
    ])
  }
}
