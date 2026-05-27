import Categorical from './categorical'
import Distribution from './_distribution'

/**
 * Probability mass function for the [Zipf-Mandelbrot distribution]{@link https://en.wikipedia.org/wiki/Zipf%E2%80%93Mandelbrot_law}:
 *
 * $f(k; N, s, q) = \frac{(k+q)^{-s}}{H_{N,s,q}},$
 *
 * with $s > 1$, $q \ge 0$, $N \in \mathbb{N}^+$ and $H_{N,s,q} = \sum_{j=1}^{N}(j+q)^{-s}$. Support: $k \in \{1, 2, \ldots, N\}$.
 *
 * @class ZipfMandelbrot
 * @memberof ran.dist
 * @constructor
 */
export default class ZipfMandelbrot extends Categorical {
  // Special case of categorical
  /**
   * @param {number} N Number of elements (support size). If not an integer, it is rounded to the nearest integer.
   * @param {number} s Exponent of the distribution.
   * @param {number} q Shift parameter.
   */
  constructor (N, s, q) {
    const Ni = Math.round(N)
    super(Array.from({ length: Ni }, (d, i) => Math.pow(i + 1 + q, -s)), 1)
    this.k = 3 // Categorical hardcodes k=2; see solutions/distribution/2026-05-27-1202-categorical-subclass-k-override.md

    // Validate parameters
    Distribution.validate({ N: Ni, s, q }, [
      'N > 0',
      's > 1',
      'q >= 0'
    ])
  }
}
