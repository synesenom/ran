import { erfc, erfcx } from '../special'
import normal from './_normal'
import exponential from './_exponential'
import Distribution from './_distribution'

/**
 * Probability density function for the [exponentially modified Gaussian distribution]{@link https://en.wikipedia.org/wiki/Exponentially_modified_Gaussian_distribution}:
 *
 * $f(x; \mu, \sigma, \lambda) = \frac{\lambda}{2} e^{\frac{\lambda}{2} (2 \mu + \lambda \sigma^2 - 2 x)} \mathrm{erfc}\Big(\frac{\mu + \lambda \sigma^2 - x}{\sqrt{2} \sigma}\Big),$
 *
 * with $\mu \in \mathbb{R}$, $\sigma > 0$ and $\lambda > 0$. Support: $x \in \mathbb{R}$.
 *
 * The distribution is the convolution of a $\mathrm{Normal}(\mu, \sigma^2)$ and an
 * $\mathrm{Exponential}(\lambda)$ random variable.
 *
 * @class ExponentiallyModifiedGaussian
 * @memberof ran.dist
 * @constructor
 */
export default class ExponentiallyModifiedGaussian extends Distribution {
  /**
   * @param {number} mu Location parameter of the Gaussian component.
   * @param {number} sigma Scale parameter of the Gaussian component.
   * @param {number} lambda Rate parameter of the exponential component.
   */
  constructor (mu, sigma, lambda) {
    super('continuous', 3)

    // Validate parameters
    this.p = { mu, sigma, lambda }
    Distribution.validate({ mu, sigma, lambda }, [
      'sigma > 0',
      'lambda > 0'
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
      sigmaSq: sigma * sigma,
      twoSigmaSq: 2 * sigma * sigma,
      sigmaRoot2: sigma * Math.SQRT2,
      lambdaSigmaSq: lambda * sigma * sigma
    }
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return this.p.mu + 1 / this.p.lambda
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    return this.c.sigmaSq + 1 / (this.p.lambda * this.p.lambda)
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const k2 = this.c.sigmaSq * this.p.lambda * this.p.lambda
    return 2 * Math.pow(k2 + 1, -1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const k2 = this.c.sigmaSq * this.p.lambda * this.p.lambda
    return 3 * (1 + 2 / k2 + 3 / (k2 * k2)) / ((1 + 1 / k2) * (1 + 1 / k2)) - 3
  }

  _generator () {
    // Exact by construction: EMG is defined as X+Y for independent X~Normal, Y~Exponential,
    // so summing one draw from each reproduces the target distribution with no rejection step
    return normal(this.r, this.p.mu, this.p.sigma) + exponential(this.r, this.p.lambda)
  }

  _pdf (x) {
    return 0.5 * this.p.lambda * this._erfcTerm(x)
  }

  _cdf (x) {
    return 0.5 * erfc(-(x - this.p.mu) / this.c.sigmaRoot2) - 0.5 * this._erfcTerm(x)
  }

  /**
   * Computes exp(exponent) * erfc(arg), the term shared by pdf and cdf, without the
   * exp(large)*erfc(large->0) cancellation of the naive textbook form. exponent - arg^2 =
   * -(x-mu)^2/(2 sigma^2) identically, so for arg > 0 (where erfc(arg) alone would underflow
   * prematurely) this is rewritten as exp(-(x-mu)^2/(2 sigma^2)) * erfcx(arg) -- same rewrite as
   * InverseGaussian's CDF (solutions/special-functions/2026-06-05-0000-inverse-gaussian-cdf-erfc-cancellation-cf-convergence.md).
   * For arg <= 0, erfc(arg) is already O(1) and exponent is bounded above by -lambda^2*sigma^2/2,
   * so the naive form is safe outright -- erfcx(arg) would instead overflow there, since
   * erfcx(z) = exp(z^2)*erfc(z) diverges as z -> -Infinity.
   *
   * @param {number} x Value to evaluate the term at.
   * @returns {number} exp(exponent) * erfc(arg).
   * @private
   */
  _erfcTerm (x) {
    const arg = (this.p.mu + this.c.lambdaSigmaSq - x) / this.c.sigmaRoot2
    if (arg <= 0) {
      const exponent = this.p.lambda * (this.p.mu + this.c.lambdaSigmaSq / 2 - x)
      return Math.exp(exponent) * erfc(arg)
    }
    return Math.exp(-(x - this.p.mu) * (x - this.p.mu) / this.c.twoSigmaSq) * erfcx(arg)
  }

  static _fitInit (data) {
    // Method of moments: mean, variance and skewness pin down (mu, sigma, lambda) uniquely
    // since EMG skewness is a strictly monotonic bijection (0, 2) <-> sigma*lambda in (inf, 0).
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) * (x - mean), 0) / n
    const std = Math.sqrt(variance) || 1
    // True skewness is always in (0, 2); clamp the noisy sample estimate into that open
    // range so (g1/2)^(1/3) and (g1/2)^(2/3) below stay finite and sigma^2 stays positive
    const g1 = Math.min(Math.max(data.reduce((s, x) => s + Math.pow((x - mean) / std, 3), 0) / n, 1e-6), 2 - 1e-6)
    const cbrt = Math.cbrt(g1 / 2)
    const tau = Math.max(std * cbrt, 1e-6)
    const sigma = Math.sqrt(Math.max(variance * (1 - Math.pow(g1 / 2, 2 / 3)), 1e-6))
    return [mean - tau, sigma, 1 / tau]
  }
}
