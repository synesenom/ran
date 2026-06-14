import { betaIncomplete } from '../special'
import Distribution from './_distribution'

/**
 * Probability mass function for the [log-series distribution]{@link https://en.wikipedia.org/wiki/Logarithmic_distribution}:
 *
 * $f(k; p) = \frac{-1}{\ln(1 - p)}\frac{p^k}{k},$
 *
 * with $p \in (0, 1)$. Support: $k \in \mathbb{N}^+$.
 *
 * @class LogSeries
 * @memberof ran.dist
 * @see A. Kemp, "Efficient generation of logarithmically distributed pseudo-random variables", Appl. Stat. 30(3), 249–253, 1981.
 * @constructor
 */
export default class LogSeries extends Distribution {
  /**
   * @param {number} p Distribution parameter.
   */
  constructor (p) {
    super('discrete', 1)

    // Validate parameters
    this.p = { p }
    Distribution.validate({ p }, [
      'p > 0', 'p < 1'
    ])

    // Set support
    this.s = [{
      value: 1,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]
  }

  static _fitInit (data) {
    // E[X] ≈ 1/(1-p)^2 for p near 1; inverting gives p ≈ 1 - 1/sqrt(mean).
    // See solutions/distribution/2026-05-28-1120-log-series-fitinit-asymptotic-inversion.md
    const mean = data.reduce((s, x) => s + x, 0) / data.length
    return [Math.max(0.01, Math.min(0.99, 1 - 1 / Math.sqrt(mean)))]
  }

  _generator () {
    // Direct sampling
    return Math.floor(1 + Math.log(this.r.next()) / Math.log(1 - Math.pow(1 - this.p.p, this.r.next())))
  }

  _pdf (x) {
    return -Math.pow(this.p.p, x) / (x * Math.log(1 - this.p.p))
  }

  _cdf (x) {
    return 1 + betaIncomplete(x + 1, 0, this.p.p) / Math.log(1 - this.p.p)
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    const p = this.p.p
    const L = Math.log1p(-p)
    return -p / ((1 - p) * L)
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const p = this.p.p
    const L = Math.log1p(-p)
    const q = 1 - p
    // var = -p*(L+p) / (q²*L²); L<0 and L+p<0 for p∈(0,1) so numerator is positive
    return -p * (L + p) / (q * q * L * L)
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const p = this.p.p
    const L = Math.log1p(-p)
    const q = 1 - p
    // Raw moments: E[K^n] = (-1/L) * T_{n-1} where T_m = sum_{k>=1} k^m * p^k
    const mu1 = -p / (q * L)
    const mu2p = -p / (q * q * L)
    const mu3p = -p * (1 + p) / (q * q * q * L)
    const v = mu2p - mu1 * mu1
    const mu3 = mu3p - 3 * mu1 * mu2p + 2 * mu1 * mu1 * mu1
    return mu3 / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const p = this.p.p
    const L = Math.log1p(-p)
    const q = 1 - p
    const mu1 = -p / (q * L)
    const mu2p = -p / (q * q * L)
    const mu3p = -p * (1 + p) / (q * q * q * L)
    const mu4p = -p * (1 + 4 * p + p * p) / (q * q * q * q * L)
    const v = mu2p - mu1 * mu1
    const mu4 = mu4p - 4 * mu1 * mu3p + 6 * mu1 * mu1 * mu2p - 3 * mu1 * mu1 * mu1 * mu1
    return mu4 / (v * v) - 3
  }
}
