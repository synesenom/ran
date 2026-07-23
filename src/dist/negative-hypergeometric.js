import { logBinomial } from '../special'
import Categorical from './categorical'
import Distribution from './_distribution'

// Rising factorial a^(m) = a(a+1)...(a+m-1); falling factorial (a)_m = a(a-1)...(a-m+1)
function riseFact (a, m) { let r = 1; for (let i = 0; i < m; i++) r *= (a + i); return r }
function fallFact (a, m) { let r = 1; for (let i = 0; i < m; i++) r *= (a - i); return r }

/**
 * Probability mass function for the [negative hypergeometric distribution]{@link https://en.wikipedia.org/wiki/Negative_hypergeometric_distribution}:
 *
 * $f(k; N, K, r) = \frac{\begin{pmatrix}k + r - 1 \\\\ k \\\\ \end{pmatrix} \begin{pmatrix}N - r - k \\\\ K - k \\\\ \end{pmatrix}}{\begin{pmatrix}N \\\\ K \\\\ \end{pmatrix}},$
 *
 * with $N \in \mathbb{N}_0$, $K \in \{0, 1, ..., N\}$ and $r \in \{0, 1, ..., N - K\}$. Support: $k \in \{0, ..., K\}$.
 *
 * @class NegativeHypergeometric
 * @memberof ran.dist
 * @constructor
 */
export default class NegativeHypergeometric extends Categorical {
  static _fitInit (data) {
    // Rough seed: N = 2*max+2, K = N/2, r = 1; Nelder-Mead refines from this.
    const maxVal = data.reduce((m, x) => x > m ? x : m, 0)
    const N = 2 * maxVal + 2
    const K = Math.max(1, Math.round(N / 2))
    return [N, K, 1]
  }

  /**
   * @param {number} N Total number of elements to sample from. If not an integer, it is rounded to the nearest one.
   * @param {number} K Total number of successes. If not an integer, it is rounded to the nearest one.
   * @param {number} r Total number of failures to stop at. If not an integer, it is rounded to the nearest one.
   */
  constructor (N, K, r) {
    // Validate parameters
    const Ni = Math.round(N)
    const Ki = Math.round(K)
    const ri = Math.round(r)
    Distribution.validate({ N: Ni, K: Ki, r: ri, 'N - K': Ni - Ki }, [
      'N >= 0',
      'K > 0', 'K <= N',
      'r > 0', 'r <= N - K'
    ])

    // Build weights
    const logBinNK = logBinomial(Ni, Ki)
    const weights = []
    for (let k = 0; k <= Ki; k++) {
      weights.push(Math.exp(logBinomial(k + ri - 1, k) + logBinomial(Ni - ri - k, Ki - k) - logBinNK))
    }
    super(weights, 0)
    this.p = { N: Ni, K: Ki, r: ri }

    // NegativeHypergeometric has 3 free parameters (N, K, r); override the 2 hardcoded by Categorical
    this.k = 3

    // Speed-up constants
    Object.assign(this.c, { logBinNK })
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    const { N, K, r } = this.p
    // E[(X)_m] = r^(m) * (K)_m / (N-K+1)^(m) (rising-r, falling-K, rising-(N-K+1))
    return riseFact(r, 1) * fallFact(K, 1) / riseFact(N - K + 1, 1)
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const { N, K, r } = this.p
    const f1 = riseFact(r, 1) * fallFact(K, 1) / riseFact(N - K + 1, 1)
    const f2 = K >= 2 ? riseFact(r, 2) * fallFact(K, 2) / riseFact(N - K + 1, 2) : 0
    return f2 + f1 - f1 * f1
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const { N, K, r } = this.p
    const base = N - K + 1
    const f1 = riseFact(r, 1) * fallFact(K, 1) / riseFact(base, 1)
    const f2 = K >= 2 ? riseFact(r, 2) * fallFact(K, 2) / riseFact(base, 2) : 0
    const f3 = K >= 3 ? riseFact(r, 3) * fallFact(K, 3) / riseFact(base, 3) : 0
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
    const { N, K, r } = this.p
    const base = N - K + 1
    const f1 = riseFact(r, 1) * fallFact(K, 1) / riseFact(base, 1)
    const f2 = K >= 2 ? riseFact(r, 2) * fallFact(K, 2) / riseFact(base, 2) : 0
    const f3 = K >= 3 ? riseFact(r, 3) * fallFact(K, 3) / riseFact(base, 3) : 0
    const f4 = K >= 4 ? riseFact(r, 4) * fallFact(K, 4) / riseFact(base, 4) : 0
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
    const { N, K, r } = this.p
    const { logBinNK } = this.c
    if (x >= K) return 1
    // Upper half: backward sum has few terms, no catastrophic cancellation in 1-bwd.
    if (x >= K / 2) {
      let bwd = 0
      for (let k = K; k > x; k--) {
        bwd += Math.exp(logBinomial(k + r - 1, k) + logBinomial(N - r - k, K - k) - logBinNK)
      }
      return Math.min(1, 1 - bwd)
    }
    let fwd = 0
    for (let k = 0; k <= x; k++) {
      fwd += Math.exp(logBinomial(k + r - 1, k) + logBinomial(N - r - k, K - k) - logBinNK)
    }
    // When CDF is small (fwd < 0.25), 1-bwd suffers catastrophic cancellation amplified
    // by ~1/CDF ≫ 1, so the forward sum alone is far more accurate.
    // When CDF ≥ 0.25 (near the midpoint), cancellation is mild; use max(fwd, 1-bwd) so
    // that exact-0.5 boundaries never fall below 0.5 and cause quantile to overshoot.
    if (fwd < 0.25) return fwd
    let bwd = 0
    for (let k = K; k > x; k--) {
      bwd += Math.exp(logBinomial(k + r - 1, k) + logBinomial(N - r - k, K - k) - logBinNK)
    }
    return Math.min(1, Math.max(fwd, 1 - bwd))
  }
}
