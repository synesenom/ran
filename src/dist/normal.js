import { erfc } from '../special'
import normal from './_normal'
import Distribution from './_distribution'

/**
 * Probability density function for the [normal distribution]{@link https://en.wikipedia.org/wiki/Normal_distribution}:
 *
 * $f(x; \mu, \sigma) = \frac{1}{\sqrt{2 \pi \sigma^2}} e^{-\frac{(x - \mu)^2}{2\sigma^2}},$
 *
 * with $\mu \in \mathbb{R}$ and $\sigma > 0$. Support: $x \in \mathbb{R}$.
 *
 * @class Normal
 * @memberof ran.dist
 * @constructor
 */
export default class Normal extends Distribution {
  /**
   * @param {number} mu Location parameter (mean).
   * @param {number} sigma Scale parameter (standard deviation).
   */
  constructor (mu, sigma) {
    super('continuous', 2)

    // Validate parameters
    /** @type {*} */
    this.p = { mu, sigma }
    Distribution.validate({ mu, sigma }, [
      'sigma > 0'
    ])

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    this.c = {
      sigmaRoot2Pi: sigma * Math.sqrt(2 * Math.PI),
      sigmaRoot2: sigma * Math.SQRT2
    }
  }

  _generator () {
    // Direct sampling
    return normal(this.r, this.p.mu, this.p.sigma)
  }

  _pdf (x) {
    return Math.exp(-0.5 * Math.pow((x - this.p.mu) / this.p.sigma, 2)) / this.c.sigmaRoot2Pi
  }

  _cdf (x) {
    // erfc avoids the 1+erf(z) cancellation for z << 0 (far left tail)
    return 0.5 * erfc(-(x - this.p.mu) / this.c.sigmaRoot2)
  }

  _q (p) {
    // A&S §26.2.17 rational approximation as O(1) seed; three Newton steps reach machine precision
    // even at 7σ (two steps leave ~1e-13 residual at extreme tails).
    const s = Math.sqrt(-2 * Math.log(p < 0.5 ? p : 1 - p))
    const z0 = s - (2.515517 + s * (0.802853 + s * 0.010328)) /
      (1 + s * (1.432788 + s * (0.189269 + s * 0.001308)))
    let z = p < 0.5 ? -z0 : z0
    for (let i = 0; i < 3; i++) {
      const phi = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)
      z -= (0.5 * erfc(-z / Math.SQRT2) - p) / phi
    }
    return this.p.mu + this.p.sigma * z
  }

  /**
   * @returns {number} Location parameter.
   */
  mean () {
    return this.p.mu
  }

  /**
   * @returns {number} Variance of the distribution (σ²).
   */
  variance () {
    return this.p.sigma ** 2
  }

  /**
   * @returns {number} Zero (the normal distribution is symmetric and mesokurtic).
   */
  skewness () {
    return 0
  }

  /**
   * @returns {number} Zero (the normal distribution is mesokurtic).
   */
  kurtosis () {
    return 0
  }

  static get _fitInitIsExact () {
    // _fitInit returns the exact closed-form MLE, so fit() skips the optimizer (ADR-0016).
    return true
  }

  static _fitInit (data) {
    const n = data.length
    const mu = data.reduce((s, x) => s + x, 0) / n
    const sigma = Math.sqrt(data.reduce((s, x) => s + (x - mu) ** 2, 0) / n) || 1
    return [mu, sigma]
  }
}
