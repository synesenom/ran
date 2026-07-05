import Distribution from './_distribution'

/**
 * Probability density function for the [asymmetric Laplace distribution]{@link https://en.wikipedia.org/wiki/Asymmetric_Laplace_distribution}:
 *
 * $f(x; \mu, \sigma, \kappa) = \frac{\sqrt{2}\kappa}{\sigma(1+\kappa^2)} \begin{cases} e^{-\frac{\sqrt{2}\kappa}{\sigma}(\mu - x)} & x < \mu \\ e^{-\frac{\sqrt{2}}{\kappa\sigma}(x - \mu)} & x \geq \mu \end{cases}$
 *
 * where $\mu \in \mathbb{R}$, $\sigma > 0$, and $\kappa > 0$. At $\kappa = 1$ it reduces to
 * $\text{Laplace}(\mu, \sigma/\sqrt{2})$. Support: $x \in \mathbb{R}$.
 *
 * @class AsymmetricLaplace
 * @memberof ran.dist
 * @constructor
 */
export default class AsymmetricLaplace extends Distribution {
  /**
   * @param {number} mu Location parameter.
   * @param {number} sigma Scale parameter.
   * @param {number} kappa Asymmetry parameter.
   */
  constructor (mu, sigma, kappa) {
    super('continuous', 3)

    // Validate parameters
    this.p = { mu, sigma, kappa }
    Distribution.validate({ mu, sigma, kappa }, [
      'sigma > 0',
      'kappa > 0'
    ])

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]

    const k2 = kappa * kappa
    const oneK2 = 1 + k2
    this.c = {
      k2,
      oneK2,
      tau: 1 / oneK2,
      k2tau: k2 / oneK2,
      C: Math.SQRT2 * kappa / (sigma * oneK2),
      leftRate: Math.SQRT2 * kappa / sigma,
      rightRate: Math.SQRT2 / (kappa * sigma)
    }
  }

  _generator () {
    return this._q(this.r.next())
  }

  _pdf (x) {
    const { mu } = this.p
    const { C, leftRate, rightRate } = this.c
    if (x < mu) {
      return C * Math.exp(-leftRate * (mu - x))
    }
    return C * Math.exp(-rightRate * (x - mu))
  }

  _cdf (x) {
    const { mu } = this.p
    const { tau, k2tau, leftRate, rightRate } = this.c
    if (x < mu) {
      return tau * Math.exp(-leftRate * (mu - x))
    }
    return 1 - k2tau * Math.exp(-rightRate * (x - mu))
  }

  _q (p) {
    const { mu, sigma, kappa } = this.p
    const { tau, k2, oneK2 } = this.c
    if (p < tau) {
      return mu + sigma / (Math.SQRT2 * kappa) * Math.log(p * oneK2)
    }
    return mu - kappa * sigma / Math.SQRT2 * Math.log((1 - p) * oneK2 / k2)
  }

  static _fitInit (data) {
    const n = data.length
    const m = data.reduce((s, x) => s + x, 0) / n
    const v = data.reduce((s, x) => s + (x - m) * (x - m), 0) / n || 1
    return [m, Math.sqrt(v), 1]
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    const { mu, sigma, kappa } = this.p
    return mu + sigma / Math.SQRT2 * (kappa - 1 / kappa)
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const { sigma } = this.p
    const { k2 } = this.c
    return sigma * sigma / 2 * (k2 + 1 / k2)
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const { kappa } = this.p
    const { k2 } = this.c
    const t = k2 + 1 / k2
    return 2 * (kappa * k2 - 1 / (kappa * k2)) / Math.pow(t, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const { k2 } = this.c
    const t = k2 + 1 / k2
    return 6 * (k2 * k2 + 1 / (k2 * k2)) / (t * t)
  }
}
