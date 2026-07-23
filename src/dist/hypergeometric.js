import { logBinomial } from '../special'
import Categorical from './categorical'
import Distribution from './_distribution'

// Falling factorial (a)_m = a(a-1)...(a-m+1)
function fallFact (a, m) { let r = 1; for (let i = 0; i < m; i++) r *= (a - i); return r }

/**
 * Probability mass function for the [hypergeometric distribution]{@link https://en.wikipedia.org/wiki/Hypergeometric_distribution}:
 *
 * $f(k; N, K, n) = \frac{\begin{pmatrix}K \\\\ k \\\\ \end{pmatrix} \begin{pmatrix}N - k \\\\ n - k \\\\ \end{pmatrix}}{\begin{pmatrix}N \\\\ n \\\\ \end{pmatrix}},$
 *
 * with $N \in \mathbb{N}^+$, $K \in \{0, 1, ..., N\}$ and $n \in \{0, 1, ..., N\}$. Support: $k \in \{\mathrm{max}(0, n+K-N), ..., \mathrm{min}(n, K)\}$.
 *
 * @class Hypergeometric
 * @memberof ran.dist
 * @constructor
 */
export default class Hypergeometric extends Categorical {
  static _fitInit (data) {
    // Rough seed: N = 2*max+2 ensures max(data) ≤ min(n, K); E[X] = nK/N seeds K.
    const maxVal = data.reduce((m, x) => x > m ? x : m, 0)
    const mean = data.reduce((s, x) => s + x, 0) / data.length
    const N = 2 * maxVal + 2
    const n = Math.max(1, Math.round(N / 2))
    const K = Math.max(1, Math.min(N - 1, Math.round(mean * N / n)))
    return [N, K, n]
  }

  /**
   * @param {number} N Total number of elements to sample from. If not an integer, it is rounded to the nearest one.
   * @param {number} K Total number of successes. If not an integer, it is rounded to the nearest one.
   * @param {number} n Number of draws. If not an integer, it is rounded to the nearest one.
   */
  constructor (N, K, n) {
    const Ni = Math.round(N)
    const Ki = Math.round(K)
    const ni = Math.round(n)

    const logBinNn = logBinomial(Ni, ni)
    const weights = []
    const min = Math.max(0, ni + Ki - Ni)
    const max = Math.min(ni, Ki)
    for (let k = min; k <= max; k++) {
      weights.push(Math.exp(logBinomial(Ki, k) + logBinomial(Ni - Ki, ni - k) - logBinNn))
    }
    super(weights, min)
    this.p = { N: Ni, K: Ki, n: ni }

    // Hypergeometric has 3 free parameters (N, K, n); override the 2 hardcoded by Categorical
    this.k = 3

    // Validate parameters
    Distribution.validate({ N: Ni, K: Ki, n: ni }, [
      'N > 0',
      'K >= 0', 'K <= N',
      'n >= 0', 'n <= N'
    ])

    // Speed-up constants
    Object.assign(this.c, { logBinNn })
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    const { N, K, n } = this.p
    return n * K / N
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const { N, K, n } = this.p
    if (N <= 1) return 0
    return n * K * (N - K) * (N - n) / (N * N * (N - 1))
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const { N, K, n } = this.p
    // E[(X)_m] = (n)_m * (K)_m / (N)_m  (falling factorial moments)
    const f1 = fallFact(n, 1) * fallFact(K, 1) / fallFact(N, 1)
    const f2 = N >= 2 && n >= 2 && K >= 2 ? fallFact(n, 2) * fallFact(K, 2) / fallFact(N, 2) : 0
    const f3 = N >= 3 && n >= 3 && K >= 3 ? fallFact(n, 3) * fallFact(K, 3) / fallFact(N, 3) : 0
    const mu2 = f2 + f1
    const v = mu2 - f1 * f1
    if (!(v > 0)) return NaN
    const mu3 = f3 + 3 * f2 + f1
    const cm3 = mu3 - 3 * f1 * mu2 + 2 * f1 * f1 * f1
    return cm3 / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const { N, K, n } = this.p
    const f1 = fallFact(n, 1) * fallFact(K, 1) / fallFact(N, 1)
    const f2 = N >= 2 && n >= 2 && K >= 2 ? fallFact(n, 2) * fallFact(K, 2) / fallFact(N, 2) : 0
    const f3 = N >= 3 && n >= 3 && K >= 3 ? fallFact(n, 3) * fallFact(K, 3) / fallFact(N, 3) : 0
    const f4 = N >= 4 && n >= 4 && K >= 4 ? fallFact(n, 4) * fallFact(K, 4) / fallFact(N, 4) : 0
    const mu2 = f2 + f1
    const v = mu2 - f1 * f1
    if (!(v > 0)) return NaN
    const mu3 = f3 + 3 * f2 + f1
    const mu4 = f4 + 6 * f3 + 7 * f2 + f1
    const cm4 = mu4 - 4 * f1 * mu3 + 6 * f1 * f1 * mu2 - 3 * f1 * f1 * f1 * f1
    return cm4 / (v * v) - 3
  }

  _cdf (x) {
    // Bidirectional raw-PMF summation bypasses AliasTable normalisation bias
    // that causes inherited prefix-sum CDF to fall ~1 ULP below exact boundaries.
    // See solutions/distribution/2026-06-03-1300-categorical-subclass-bidirectional-cdf-quantile-overshoot.md
    const { N, K, n } = this.p
    const lo = Math.max(0, n + K - N)
    const hi = Math.min(n, K)
    if (x >= hi) return 1
    const { logBinNn } = this.c
    let fwd = 0
    for (let k = lo; k <= x; k++) {
      fwd += Math.exp(logBinomial(K, k) + logBinomial(N - K, n - k) - logBinNn)
    }
    let bwd = 0
    for (let k = hi; k > x; k--) {
      bwd += Math.exp(logBinomial(K, k) + logBinomial(N - K, n - k) - logBinNn)
    }
    return Math.min(1, Math.max(fwd, 1 - bwd))
  }
}
