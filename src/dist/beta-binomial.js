import Categorical from './categorical'
import { logBeta, logBinomial } from '../special'
import Distribution from './_distribution'

/**
 * Probability mass function for the [beta-binomial distribution]{@link https://en.wikipedia.org/wiki/Beta-binomial_distribution}:
 *
 * $f(k; n, \alpha, \beta) = \begin{pmatrix}n \\\\ k \\\\ \end{pmatrix} \frac{\mathrm{B}(\alpha + k, \beta + n - k)}{\mathrm{B}(\alpha, \beta)},$
 *
 * with $n \in \mathbb{N}_0$ and $\alpha, \beta > 0$. Support: $k \in \{0, ..., n\}$.
 *
 * @class BetaBinomial
 * @memberof ran.dist
 * @constructor
 */
export default class BetaBinomial extends Categorical {
  static _fitInit (data) {
    // n = max(data); moment-match alpha, beta from mean proportion and overdispersion.
    const n = Math.max(1, data.reduce((m, x) => x > m ? x : m, 0))
    const mean = data.reduce((s, x) => s + x, 0) / data.length
    const variance = data.reduce((s, x) => s + x * x, 0) / data.length - mean * mean
    const m1 = mean / n
    const binVar = n * m1 * (1 - m1)
    const v = binVar > 0 ? Math.max(1.01, variance / binVar) : 2
    const phi = Math.max(0.1, (n - v) / (v - 1))
    return [n, Math.max(0.1, m1 * phi), Math.max(0.1, (1 - m1) * phi)]
  }

  /**
   * @param {number} n Number of trials.
   * @param {number} alpha First shape parameter.
   * @param {number} beta Second shape parameter.
   */
  constructor (n, alpha, beta) {
    const ni = Math.round(n)
    super(Array.from({ length: ni + 1 }, (d, i) => Math.exp(logBinomial(ni, i) + logBeta(i + alpha, ni - i + beta) - logBeta(alpha, beta))), 0)
    this.p = { n: ni, alpha, beta }

    // Validate parameters
    Distribution.validate({ n: ni, alpha, beta }, [
      'n >= 0',
      'alpha > 0',
      'beta > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: ni,
      closed: true
    }]
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    const { n, alpha, beta } = this.p
    return n * alpha / (alpha + beta)
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const { n, alpha, beta } = this.p
    const s = alpha + beta
    return n * alpha * beta * (s + n) / (s * s * (s + 1))
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const { n, alpha, beta } = this.p
    const s = alpha + beta
    const variance = n * alpha * beta * (s + n) / (s * s * (s + 1))
    if (!(variance > 0)) return NaN
    // Computed from factorial moments E[(X)_r] = (n)_r * (alpha)_r / (s)_r
    const m1 = n * alpha / s
    const b = n * (n - 1) * alpha * (alpha + 1) / (s * (s + 1))
    const c3 = n * (n - 1) * (n - 2) * alpha * (alpha + 1) * (alpha + 2) / (s * (s + 1) * (s + 2))
    const m2 = m1 + b
    const m3 = m1 + 3 * b + c3
    return (m3 - 3 * m1 * m2 + 2 * m1 * m1 * m1) / Math.pow(variance, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const { n, alpha, beta } = this.p
    const s = alpha + beta
    const variance = n * alpha * beta * (s + n) / (s * s * (s + 1))
    if (!(variance > 0)) return NaN
    // Computed from factorial moments E[(X)_r] = (n)_r * (alpha)_r / (s)_r
    const m1 = n * alpha / s
    const b = n * (n - 1) * alpha * (alpha + 1) / (s * (s + 1))
    const c3 = n * (n - 1) * (n - 2) * alpha * (alpha + 1) * (alpha + 2) / (s * (s + 1) * (s + 2))
    const c4 = n * (n - 1) * (n - 2) * (n - 3) * alpha * (alpha + 1) * (alpha + 2) * (alpha + 3) / (s * (s + 1) * (s + 2) * (s + 3))
    const m2 = m1 + b
    const m3 = m1 + 3 * b + c3
    const m4 = m1 + 7 * b + 6 * c3 + c4
    const mu4 = m4 - 4 * m1 * m3 + 6 * m1 * m1 * m2 - 3 * m1 * m1 * m1 * m1
    return mu4 / (variance * variance) - 3
  }

  _cdf (x) {
    // Bidirectional raw-PMF summation bypasses AliasTable normalisation bias that
    // causes prefix-sum CDF to fall ~1 ULP below exact boundaries (e.g. CDF(12) < 0.5
    // for symmetric n=25, α=β=2), which makes q(0.5) overshoot by one.
    // See solutions/distribution/2026-06-03-1300-categorical-subclass-bidirectional-cdf-quantile-overshoot.md
    const { n, alpha, beta } = this.p
    if (x >= n) return 1
    const logBetaAB = logBeta(alpha, beta)
    // Upper half: backward sum has few terms, no catastrophic cancellation in 1-bwd.
    if (x >= n / 2) {
      let bwd = 0
      for (let k = n; k > x; k--) {
        bwd += Math.exp(logBinomial(n, k) + logBeta(k + alpha, n - k + beta) - logBetaAB)
      }
      return Math.min(1, 1 - bwd)
    }
    let fwd = 0
    for (let k = 0; k <= x; k++) {
      fwd += Math.exp(logBinomial(n, k) + logBeta(k + alpha, n - k + beta) - logBetaAB)
    }
    // When CDF is small (fwd < 0.25), 1-bwd suffers catastrophic cancellation amplified
    // by ~1/CDF ≫ 1, so the forward sum alone is far more accurate.
    // When CDF ≥ 0.25 (near the midpoint), cancellation is mild; use max(fwd, 1-bwd) so
    // that exact-0.5 boundaries (symmetric distributions) never fall below 0.5 and
    // cause quantile to overshoot by one.
    if (fwd < 0.25) return fwd
    let bwd = 0
    for (let k = n; k > x; k--) {
      bwd += Math.exp(logBinomial(n, k) + logBeta(k + alpha, n - k + beta) - logBetaAB)
    }
    return Math.min(1, Math.max(fwd, 1 - bwd))
  }
}
