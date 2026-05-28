import Categorical from './categorical'
import Distribution from './_distribution'

/**
 * Probability mass function for the [Zipf distribution]{@link https://en.wikipedia.org/wiki/Zipf%27s_law}:
 *
 * $f(k; s, N) = \frac{k^{-s}}{H_{N, s}},$
 *
 * with $s \ge 0$, $N \in \mathbb{N}^+$ and $H_{N, s}$ denotes the generalized harmonic number. Support: $k \in \{1, 2, ..., N\}$.
 *
 * @class Zipf
 * @memberof ran.dist
 * @constructor
 */
export default class Zipf extends Categorical {
  // Special case of categorical
  /**
   * @param {number} s Exponent of the distribution.
   * @param {number} N Number of words. If not an integer, it is rounded to the nearest integer. Default is 100.
   */
  static _fitInit (data) {
    // N ≈ max(data) as support size; Hill estimator gives MLE for power-law exponent s.
    const N = data.reduce((m, x) => x > m ? x : m, 1)
    const sumLog = data.reduce((s, x) => s + Math.log(x), 0)
    return [sumLog <= 0 ? 1 : Math.max(0.01, Math.min(100, 1 + data.length / sumLog)), N]
  }

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
