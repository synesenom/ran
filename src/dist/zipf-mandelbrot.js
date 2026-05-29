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
  static _fitInit (data) {
    // N ≈ max(data); Hill estimator for s; q from rank-1/rank-2 PMF ratio
    const n = data.length
    const N = data.reduce((m, x) => x > m ? x : m, 1)
    const sumLog = data.reduce((s, x) => s + Math.log(x), 0)
    const s = sumLog <= 0 ? 2 : Math.max(1.1, Math.min(20, 1 + n / sumLog))
    const freq = {}
    for (const x of data) freq[x] = (freq[x] || 0) + 1
    const f1 = (freq[1] || 1) / n
    const f2 = (freq[2] || 0) / n
    if (f2 <= 0) return [N, s, 0]
    // P(1)/P(2) = ((2+q)/(1+q))^s → q = (2 - e^r)/(e^r - 1), r = log(f1/f2)/s
    const er = Math.exp(Math.log(f1 / f2) / s)
    const q = (er >= 2 || er <= 1 + 1e-6) ? 0 : Math.max(0, (2 - er) / (er - 1))
    return [N, s, q]
  }

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
