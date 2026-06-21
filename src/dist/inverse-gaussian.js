import { erfc, erfcx } from '../special'
import normal from './_normal'
import Distribution from './_distribution'

/**
 * Probability density function for the Wald or [inverse Gaussian distribution]{@link https://en.wikipedia.org/wiki/Inverse_Gaussian_distribution}:
 *
 * $f(x; \lambda, \mu) = \bigg\[\frac{\lambda}{2 \pi x^3}\bigg\]^{1/2} e^{\frac{-\lambda (x - \mu)^2}{2 x \mu^2}},$
 *
 * with $\mu, \lambda > 0$. Support: $x > 0$.
 *
 * @class InverseGaussian
 * @memberof ran.dist
 * @see J. R. Michael, W. R. Schucany and R. W. Haas, "Generating Random Variates Using Transformations with Multiple Roots", Am. Stat. 30(2), 88–90, 1976.
 * @constructor
 */
export default class InverseGaussian extends Distribution {
  /**
   * @param {number} mu Mean of the distribution.
   * @param {number} lambda Shape parameter.
   */
  constructor (mu, lambda) {
    super('continuous', 2)

    // Validate parameters
    this.p = { mu, lambda }
    Distribution.validate({ mu, lambda }, [
      'mu > 0',
      'lambda > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    this.c = {
      halfMuOverLambda: 0.5 * mu / lambda,
      twoLambdaOverMu: 2 * lambda / mu,
      sqrtLambdaOverMuSq: Math.sqrt(lambda / (mu * mu))
    }
  }

  _generator () {
    // Direct sampling
    const nu = normal(this.r)

    const y = nu * nu

    const x = this.p.mu + this.c.halfMuOverLambda * this.p.mu * y - this.c.halfMuOverLambda * Math.sqrt(this.p.mu * y * (4 * this.p.lambda + this.p.mu * y))
    return this.r.next() > this.p.mu / (this.p.mu + x) ? this.p.mu * this.p.mu / x : x
  }

  static get _fitInitIsExact () {
    // _fitInit returns the exact closed-form MLE, so fit() skips the optimizer (ADR-0016).
    return true
  }

  static _fitInit (data) {
    // Exact MLE: mu = sample mean, lambda = n / Σ(1/xᵢ − 1/x̄). By the AM-HM inequality the sum
    // is ≥ 0, vanishing only for constant data — fall back to the moment estimate there.
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const invDev = data.reduce((s, x) => s + (1 / x - 1 / mean), 0)
    if (invDev > 0) {
      return [mean, n / invDev]
    }
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || mean * mean
    return [mean, mean * mean * mean / variance]
  }

  _pdf (x) {
    return Math.sqrt(this.p.lambda / (2 * Math.PI * Math.pow(x, 3))) * Math.exp(-this.p.lambda * Math.pow(x - this.p.mu, 2) / (2 * this.p.mu * this.p.mu * x))
  }

  _cdf (x) {
    const s = Math.sqrt(this.p.lambda / x)
    const st = Math.sqrt(x) * this.c.sqrtLambdaOverMuSq
    const a = Math.SQRT1_2 * (st - s)
    const b = Math.SQRT1_2 * (st + s)
    // erfc(-a) avoids 1+erf cancellation in the lower tail.
    // erfcx(b)·exp(2λ/μ − b²) avoids overflow for large 2λ/μ; the exponent ≤ 0 always.
    // See solutions/special-functions/2026-06-05-0000-inverse-gaussian-cdf-erfc-cancellation-cf-convergence.md
    return Math.min(1, 0.5 * (erfc(-a) + erfcx(b) * Math.exp(this.c.twoLambdaOverMu - b * b)))
  }

  /**
   * @returns {number} Mean of the distribution (equals μ).
   */
  mean () {
    return this.p.mu
  }

  /**
   * @returns {number} Variance of the distribution (μ³/λ).
   */
  variance () {
    return Math.pow(this.p.mu, 3) / this.p.lambda
  }

  /**
   * @returns {number} Skewness of the distribution (3√(μ/λ)).
   */
  skewness () {
    return 3 * Math.sqrt(this.p.mu / this.p.lambda)
  }

  /**
   * @returns {number} Excess kurtosis of the distribution (15μ/λ).
   */
  kurtosis () {
    return 15 * this.p.mu / this.p.lambda
  }
}
