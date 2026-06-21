import { generalizedHarmonic } from '../special'
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
  static _fitInit (data) {
    // N ≈ max(data) as support size; Hill estimator gives MLE for power-law exponent s.
    const N = data.reduce((m, x) => x > m ? x : m, 1)
    const sumLog = data.reduce((s, x) => s + Math.log(x), 0)
    return [sumLog <= 0 ? 1 : Math.max(0.01, Math.min(100, 1 + data.length / sumLog)), N]
  }

  /**
   * @param {number} s Exponent of the distribution.
   * @param {number} N Number of words. If not an integer, it is rounded to the nearest integer. Default is 100.
   */
  constructor (s, N) {
    const Ni = Math.round(N)
    super(Array.from({ length: Ni }, (d, i) => Math.pow(i + 1, -s)), 1)
    this.p = { s, N: Ni }

    // Validate parameters
    Distribution.validate({ s, N: Ni }, [
      's >= 0',
      'N > 0'
    ])

    // E[X^r] = H(N, s-r) / H(N, s); precompute for r=0..4
    const h0 = generalizedHarmonic(Ni, s)
    Object.assign(this.c, {
      h0,
      h1: generalizedHarmonic(Ni, s - 1),
      h2: generalizedHarmonic(Ni, s - 2),
      h3: generalizedHarmonic(Ni, s - 3),
      h4: generalizedHarmonic(Ni, s - 4)
    })
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return this.c.h1 / this.c.h0
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const { h0, h1, h2 } = this.c
    const mu1 = h1 / h0
    return h2 / h0 - mu1 * mu1
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const { h0, h1, h2, h3 } = this.c
    const mu1 = h1 / h0; const mu2 = h2 / h0; const mu3 = h3 / h0
    const v = mu2 - mu1 * mu1
    if (!(v > 0)) return NaN
    const cm3 = mu3 - 3 * mu1 * mu2 + 2 * mu1 * mu1 * mu1
    return cm3 / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const { h0, h1, h2, h3, h4 } = this.c
    const mu1 = h1 / h0; const mu2 = h2 / h0; const mu3 = h3 / h0; const mu4 = h4 / h0
    const v = mu2 - mu1 * mu1
    if (!(v > 0)) return NaN
    const cm4 = mu4 - 4 * mu1 * mu3 + 6 * mu1 * mu1 * mu2 - 3 * mu1 * mu1 * mu1 * mu1
    return cm4 / (v * v) - 3
  }
}
