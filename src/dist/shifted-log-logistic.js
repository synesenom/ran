import Distribution from './_distribution'

/**
 * Probability density function for the [shifted log-logistic distribution]{@link https://en.wikipedia.org/wiki/Shifted_log-logistic_distribution}:
 *
 * $f(x; \mu, \sigma, \xi) = \frac{(1 + \xi z)^{-(1/\xi + 1)}}{\sigma \[1 + (1 + \xi z)^{-1/\xi}\]^2},$
 *
 * with $z = \frac{x - \mu}{\sigma}$, $\mu, \xi \in \mathbb{R}$ and $\sigma > 0$. Support: $x \ge \mu - \sigma/\xi$ if $\xi > 0$, $x \le \mu - \sigma/\xi$ if $\xi < 0$, $x \in \mathbb{R}$ otherwise.
 *
 * @class ShiftedLogLogistic
 * @memberof ran.dist
 * @constructor
 */
export default class ShiftedLogLogistic extends Distribution {
  /**
   * @param {number} mu Location parameter.
   * @param {number} sigma Scale parameter.
   * @param {number} xi Shape parameter.
   */
  constructor (mu, sigma, xi) {
    super('continuous', 3)

    // Validate parameters
    this.p = { mu, sigma, xi }
    Distribution.validate({ mu, sigma, xi }, [
      'sigma > 0'
    ])

    // Set support
    this.s = xi === 0
      ? [{ value: -Infinity, closed: false }, { value: Infinity, closed: false }]
      : [{ value: xi > 0 ? mu - sigma / xi : -Infinity, closed: xi > 0 },
          { value: xi < 0 ? mu - sigma / xi : Infinity, closed: xi < 0 }]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    if (this.p.xi === 0) {
      // Fall back to logistic
      const z = Math.exp(-(x - this.p.mu) / this.p.sigma)
      return Number.isFinite(z * z)
        ? z / (this.p.sigma * Math.pow(1 + z, 2))
        : 0
    } else {
      const z = (x - this.p.mu) / this.p.sigma

      return Math.pow(1 + this.p.xi * z, -(1 / this.p.xi + 1)) / (this.p.sigma * Math.pow(1 + Math.pow(1 + this.p.xi * z, -1 / this.p.xi), 2))
    }
  }

  _cdf (x) {
    if (this.p.xi === 0) {
      // Fall back to logistic
      return 1 / (1 + Math.exp(-(x - this.p.mu) / this.p.sigma))
    } else {
      const z = (x - this.p.mu) / this.p.sigma
      const y = Math.pow(1 + this.p.xi * z, -1 / this.p.xi)
      return Number.isFinite(y) ? 1 / (1 + y) : 0
    }
  }

  _q (p) {
    if (this.p.xi === 0) {
      // Fall back to logistic
      return this.p.mu - this.p.sigma * Math.log(1 / p - 1)
    } else {
      return this.p.mu + this.p.sigma * (Math.pow(1 / p - 1, -this.p.xi) - 1) / this.p.xi
    }
  }

  /**
   * @returns {number} The mean, or `Infinity` when $|\xi| \ge 1$.
   */
  mean () {
    const { mu, sigma, xi } = this.p
    if (xi === 0) return mu
    if (Math.abs(xi) >= 1) return xi > 0 ? Infinity : -Infinity
    // B₁ = Γ(1+ξ)Γ(1−ξ) = πξ/sin(πξ) via reflection formula
    const b1 = Math.PI * xi / Math.sin(Math.PI * xi)
    return mu + sigma * (b1 - 1) / xi
  }

  /**
   * @returns {number} The variance, or `Infinity` when $|\xi| \ge 1/2$.
   */
  variance () {
    const { sigma, xi } = this.p
    if (xi === 0) return sigma * sigma * Math.PI * Math.PI / 3
    if (Math.abs(xi) >= 0.5) return Infinity
    const b1 = Math.PI * xi / Math.sin(Math.PI * xi)
    const b2 = 2 * Math.PI * xi / Math.sin(2 * Math.PI * xi)
    return (sigma / xi) * (sigma / xi) * (b2 - b1 * b1)
  }

  /**
   * @returns {number} The skewness, `Infinity` when $1/3 \le |\xi| < 1/2$, `NaN` when $|\xi| \ge 1/2$.
   */
  skewness () {
    const { sigma, xi } = this.p
    if (xi === 0) return 0
    if (Math.abs(xi) >= 0.5) return NaN
    if (Math.abs(xi) >= 1 / 3) return xi > 0 ? Infinity : -Infinity
    const b1 = Math.PI * xi / Math.sin(Math.PI * xi)
    const b2 = 2 * Math.PI * xi / Math.sin(2 * Math.PI * xi)
    const b3 = 3 * Math.PI * xi / Math.sin(3 * Math.PI * xi)
    const sv = sigma / xi
    const kappa2 = sv * sv * (b2 - b1 * b1)
    const mu3 = sv * sv * sv * (b3 - 3 * b1 * b2 + 2 * b1 * b1 * b1)
    return mu3 / Math.pow(kappa2, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis, `Infinity` when $1/4 \le |\xi| < 1/2$, `NaN` when $|\xi| \ge 1/2$.
   */
  kurtosis () {
    const { sigma, xi } = this.p
    if (xi === 0) return 6 / 5
    if (Math.abs(xi) >= 0.5) return NaN
    if (Math.abs(xi) >= 1 / 4) return Infinity
    const b1 = Math.PI * xi / Math.sin(Math.PI * xi)
    const b2 = 2 * Math.PI * xi / Math.sin(2 * Math.PI * xi)
    const b3 = 3 * Math.PI * xi / Math.sin(3 * Math.PI * xi)
    const b4 = 4 * Math.PI * xi / Math.sin(4 * Math.PI * xi)
    const sv = sigma / xi
    const kappa2 = sv * sv * (b2 - b1 * b1)
    const mu4 = sv * sv * sv * sv * (b4 - 4 * b1 * b3 + 6 * b1 * b1 * b2 - 3 * b1 * b1 * b1 * b1)
    return mu4 / (kappa2 * kappa2) - 3
  }

  static _fitInit (data) {
    // xi=0 is the logistic limit where median = mu and IQR = 2σln3; seed xi=0 for Nelder-Mead
    const sorted = [...data].sort((a, b) => a - b)
    const n = sorted.length
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[(n - 1) / 2]
    const q1 = sorted[Math.floor(n * 0.25)]
    const q3 = sorted[Math.floor(n * 0.75)]
    const sigma = Math.max((q3 - q1) / (2 * Math.log(3)), 1e-3)
    return [median, sigma, 0]
  }
}
