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
    this.p = { N: Ni, s, q }

    // Validate parameters
    Distribution.validate({ N: Ni, s, q }, [
      'N > 0',
      's > 1',
      'q >= 0'
    ])

    // Precompute raw moment numerators from the normalized PMF (pdfTable[k-1] = P(X=k))
    let mu1 = 0; let mu2 = 0; let mu3 = 0; let mu4 = 0
    for (let k = 1; k <= Ni; k++) {
      const p = this.pdfTable[k - 1]
      mu1 += k * p
      mu2 += k * k * p
      mu3 += k * k * k * p
      mu4 += k * k * k * k * p
    }
    Object.assign(this.c, { mu1, mu2, mu3, mu4 })
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return this.c.mu1
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const { mu1, mu2 } = this.c
    return mu2 - mu1 * mu1
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const { mu1, mu2, mu3 } = this.c
    const v = mu2 - mu1 * mu1
    if (!(v > 0)) return NaN
    const cm3 = mu3 - 3 * mu1 * mu2 + 2 * mu1 * mu1 * mu1
    return cm3 / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const { mu1, mu2, mu3, mu4 } = this.c
    const v = mu2 - mu1 * mu1
    if (!(v > 0)) return NaN
    const cm4 = mu4 - 4 * mu1 * mu3 + 6 * mu1 * mu1 * mu2 - 3 * mu1 * mu1 * mu1 * mu1
    return cm4 / (v * v) - 3
  }
}
