import { regularizedBetaIncomplete, logBeta } from '../special'
import rBeta from './_beta'
import Distribution from './_distribution'

/**
 * Probability density function for the [beta distribution]{@link https://en.wikipedia.org/wiki/Beta_distribution}:
 *
 * $f(x; \alpha, \beta) = \frac{x^{\alpha - 1}(1 - x)^{\beta - 1}}{\mathrm{B}(\alpha, \beta)},$
 *
 * with $\alpha, \beta > 0$ and $\mathrm{B}(\alpha, \beta)$ is the beta function.
 * Support: $x \in (0, 1)$.
 *
 * @class Beta
 * @memberof ran.dist
 * @constructor
 */
export default class Beta extends Distribution {
  /**
   * @param {number} alpha First shape parameter.
   * @param {number} beta Second shape parameter.
   */
  constructor (alpha, beta) {
    super('continuous', 2)

    // Validate parameters
    this.p = { alpha, beta }
    Distribution.validate({ alpha, beta }, [
      'alpha > 0',
      'beta > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: alpha >= 1
    }, {
      value: 1,
      closed: beta >= 1
    }]

    // Speed-up constants
    this.c = {
      lnBeta: logBeta(alpha, beta),
      alphaM1: alpha - 1,
      betaM1: beta - 1
    }
  }

  static _fitInit (data) {
    // Re-parametrizing subclasses (R, F, FisherZ, BaldingNichols) must override this — they
    // inherit it otherwise and get Beta's [alpha, beta] vector with the wrong arity/domain.
    // See solutions/correctness/2026-05-28-1851-reparametrizing-subclass-inherits-wrong-fitinit.md
    // Beta MOM: α = x̄·φ, β = (1−x̄)·φ, φ = x̄(1−x̄)/var − 1
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1e-4
    const factor = Math.max(mean * (1 - mean) / variance - 1, 0.1)
    return [mean * factor, (1 - mean) * factor]
  }

  static _fitPenalty (dist) {
    // Jeffreys-like log-barrier on the underlying shape parameters: repels the Powell optimizer
    // from near-zero alpha/beta where lnL is large-but-finite, without distorting interior
    // solutions. Inherited by BetaRectangular, BetaPrime and all other Beta subclasses via
    // dist.p.alpha / dist.p.beta (set by super() in every constructor regardless of the
    // subclass's own param ordering). See decisions/0017-beta-fit-penalty.md and
    // solutions/correctness/2026-06-03-1200-beta-fit-log-barrier-and-survival-support-clipping.md.
    return -0.5 * (Math.log(dist.p.alpha) + Math.log(dist.p.beta))
  }

  _generator () {
    // Direct generation
    return rBeta(this.r, this.p.alpha, this.p.beta)
  }

  _pdf (x) {
    if (this.c.alphaM1 === 0 && this.c.betaM1 === 0) {
      return 1
    }

    const a = this.c.alphaM1 * Math.log(x)

    const b = this.c.betaM1 * Math.log(1 - x)

    // Handle x = 0 and x = 1 cases
    return Math.exp(a + b - this.c.lnBeta)
  }

  _cdf (x) {
    return regularizedBetaIncomplete(this.p.alpha, this.p.beta, x)
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    const s = this.p.alpha + this.p.beta
    return this.p.alpha / s
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const s = this.p.alpha + this.p.beta
    return this.p.alpha * this.p.beta / (s * s * (s + 1))
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const { alpha, beta } = this.p
    const s = alpha + beta
    return 2 * (beta - alpha) * Math.sqrt(s + 1) / ((s + 2) * Math.sqrt(alpha * beta))
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const { alpha, beta } = this.p
    const s = alpha + beta
    return 6 * ((alpha - beta) ** 2 * (s + 1) - alpha * beta * (s + 2)) /
      (alpha * beta * (s + 2) * (s + 3))
  }
}
