import Distribution from './_distribution'

/**
 * Probability density function for the [Cauchy distribution]{@link https://en.wikipedia.org/wiki/Cauchy_distribution}:
 *
 * $f(x; x_0, \gamma) = \frac{1}{\pi\gamma\bigg\[1 + \Big(\frac{x - x_0}{\gamma}\Big)^2\bigg\]}$
 *
 * where $x_0 \in \mathbb{R}$ and $\gamma > 0$. Support: $x \in \mathbb{R}$.
 *
 * @class Cauchy
 * @memberof ran.dist
 * @constructor
 */
export default class Cauchy extends Distribution {
  /**
   * @param {number} x0 Location parameter.
   * @param {number} gamma Scale parameter.
   */
  constructor (x0, gamma) {
    super('continuous', 2)

    // Validate parameters
    this.p = { x0, gamma }
    Distribution.validate({ x0, gamma }, [
      'gamma > 0'
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
      piGamma: Math.PI * this.p.gamma
    }
  }

  _generator () {
    // Inverse transform sampling
    return this.p.x0 + this.p.gamma * (Math.tan(Math.PI * (this.r.next() - 0.5)))
  }

  _pdf (x) {
    const y = (x - this.p.x0) / this.p.gamma
    return 1 / (this.c.piGamma * (1 + y * y))
  }

  _cdf (x) {
    return 0.5 + Math.atan2(x - this.p.x0, this.p.gamma) / Math.PI
  }

  _q (p) {
    return this.p.x0 + this.p.gamma * (Math.tan(Math.PI * (p - 0.5)))
  }

  // Cauchy moments are all undefined — quantile truncation makes the numerical
  // fallback return finite values (≈0 for mean by symmetry), so explicit NaN is required.

  /**
   * @returns {number} NaN (mean is undefined for the Cauchy distribution).
   */
  mean () { return NaN }

  /**
   * @returns {number} NaN (variance is undefined for the Cauchy distribution).
   */
  variance () { return NaN }

  /**
   * @returns {number} NaN (skewness is undefined for the Cauchy distribution).
   */
  skewness () { return NaN }

  /**
   * @returns {number} NaN (excess kurtosis is undefined for the Cauchy distribution).
   */
  kurtosis () { return NaN }

  static _fitInit (data) {
    // Cauchy moments don't exist; median = x0 and IQR = 2*gamma give robust location and scale estimates
    const sorted = data.slice().sort((a, b) => a - b)
    const n = sorted.length
    const mid = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    const q1 = sorted[Math.floor(n / 4)]
    const q3 = sorted[Math.floor(3 * n / 4)]
    return [mid, Math.max((q3 - q1) / 2, 1e-3)]
  }
}
