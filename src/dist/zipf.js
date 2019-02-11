import Categorical from './categorical'

/**
 * Generator for the [Zipf distribution]{@link https://en.wikipedia.org/wiki/Zipf%27s_law}:
 *
 * $$f(k; s, N) = \frac{k^{-s}}{H_{N, s}},$$
 *
 * with \(s \in \mathbb{R}^+ \cup \{0\}\), \(N \in \mathbb{N}^+\) and \(H_{N, s}\) denotes the generalized harmonic number. Support: \(k \in \{1, 2, ..., N\}\).
 *
 * @class Zipf
 * @memberOf ran.dist
 * @param {number=} s Exponent of the distribution. Default value is 2.
 * @param {number=} N Number of words. Default is 100.
 * @constructor
 */
export default class extends Categorical {
  // Special case of categorical
  constructor (s = 1, N = 100) {
    super(Array.from({ length: N }, (d, i) => Math.pow(i + 1, -s)), 1)
  }
}
