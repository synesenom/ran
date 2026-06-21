import { besselI, marcumP } from '../special'
import gamma from './_gamma'
import poisson from './_poisson'
import Distribution from './_distribution'

/**
 * Probability density function for the [Rice distribution]{@link https://en.wikipedia.org/wiki/Rice_distribution}:
 *
 * $f(x; \nu, \sigma) = \frac{x}{\sigma^2} e^{-\frac{x^2 + \nu^2}{2 \sigma^2}} I_0\bigg(\frac{\nu x}{\sigma^2}\bigg),$
 *
 * with $\nu, \sigma > 0$ and $I_0(x)$ is the modified Bessel function of the first kind with order zero. Support: $x \in [0, \infty)$.
 *
 * @class Rice
 * @memberof ran.dist
 * @constructor
 */
export default class Rice extends Distribution {
  /**
   * @param {number} nu First shape parameter.
   * @param {number} sigma Second shape parameter.
   */
  constructor (nu, sigma) {
    super('continuous', 2)

    // Validate parameters
    this.p = { nu, sigma }
    Distribution.validate({ nu, sigma }, [
      'nu > 0',
      'sigma > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    const z = 0.25 * Math.pow(nu / sigma, 2)
    const b0 = besselI(0, z)
    let eb0, eb1
    if (Number.isFinite(b0)) {
      const ez = Math.exp(-z)
      eb0 = ez * b0
      eb1 = ez * besselI(1, z)
    } else {
      // First-order asymptotic: e^{-z}I_n(z) ≈ [1−(4n²−1)/(8z)]/√(2πz).
      // Zeroth-order (same correction for I₀/I₁) causes catastrophic cancellation in variance.
      const s = 1 / Math.sqrt(2 * Math.PI * z)
      eb0 = s * (1 + 1 / (8 * z))
      eb1 = s * (1 - 3 / (8 * z))
    }
    this.c = {
      halfNuSqRatio: 0.5 * Math.pow(nu / sigma, 2),
      sigma2: sigma * sigma,
      nuOverSigma2: nu / (sigma * sigma),
      nu2: nu * nu,
      z,
      eb0,
      eb1,
      // Flag for asymptotic regime (z > ~709): kurtosis via raw moments suffers
      // O(σ⁴) cancellation error from Bessel asymptotics; return Gaussian limit instead.
      asymptotic: !Number.isFinite(b0)
    }
  }

  _generator () {
    // Direct sampling using Poisson and gamma
    const p = poisson(this.r, this.c.halfNuSqRatio)
    const x = gamma(this.r, p + 1, 0.5)
    return this.p.sigma * Math.sqrt(x)
  }

  static _fitInit (data) {
    // Rayleigh-limit moment seed: σ≈std/√(2−π/2), then ν²=E[X²]−2σ² (mean/std inversion)
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || mean * mean
    const sigma = Math.max(Math.sqrt(variance) / Math.sqrt(2 - Math.PI / 2), 1e-3)
    const m2 = mean * mean + variance
    const nu = Math.max(Math.sqrt(Math.max(m2 - 2 * sigma * sigma, 0)), 1e-3)
    return [nu, sigma]
  }

  _pdf (x) {
    const z = x * this.p.nu / this.c.sigma2
    const b = besselI(0, z)

    // Handle z >> 1 case (using asymptotic form of Bessel)
    if (Number.isFinite(b)) {
      return x * Math.exp(-0.5 * (x * x + this.c.nu2) / this.c.sigma2) * besselI(0, x * this.c.nuOverSigma2) / this.c.sigma2
    } else {
      return x * Math.exp(-0.5 * (x * x + this.c.nu2) / this.c.sigma2 + z - 0.5 * Math.log(2 * Math.PI * z)) / this.c.sigma2
    }
  }

  _cdf (x) {
    // Complementary Marcum Q avoids catastrophic cancellation in the
    // lower tail: `1 - marcumQ(...)` would lose precision because
    // marcumQ internally forms `1 - P` to deliver Q (#246).
    return marcumP(1, this.c.halfNuSqRatio, Math.pow(x / this.p.sigma, 2) / 2)
  }

  /**
   * @returns {number} Mean of the distribution (σ√(π/2)·L_{1/2}(−ν²/2σ²)).
   */
  mean () {
    const { z, eb0, eb1 } = this.c
    return this.p.sigma * Math.sqrt(Math.PI / 2) * ((1 + 2 * z) * eb0 + 2 * z * eb1)
  }

  /**
   * @returns {number} Variance (2σ²+ν²−mean²).
   */
  variance () {
    const mean = this.mean()
    return 2 * this.c.sigma2 + this.c.nu2 - mean * mean
  }

  /**
   * @returns {number} Skewness from raw moments via Laguerre L_{3/2}.
   */
  skewness () {
    const { sigma } = this.p
    const { sigma2, nu2, z, eb0, eb1 } = this.c
    const m1 = sigma * Math.sqrt(Math.PI / 2) * ((1 + 2 * z) * eb0 + 2 * z * eb1)
    const m2 = 2 * sigma2 + nu2
    // E[X³]=σ³√(2π)·e^{-z}[(3/2+6z+4z²)I₀(z)+4z(1+z)I₁(z)]; derived via L_{3/2} recursion.
    const m3 = sigma2 * sigma * Math.sqrt(2 * Math.PI) * ((1.5 + 6 * z + 4 * z * z) * eb0 + 4 * z * (1 + z) * eb1)
    const v = m2 - m1 * m1
    return (m3 - 3 * m1 * m2 + 2 * m1 * m1 * m1) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} Excess kurtosis from raw moments.
   */
  kurtosis () {
    // In the asymptotic regime the μ₄ formula suffers O(σ⁴) cancellation from
    // Bessel errors; the exact limit is 0 (Gaussian), accurate to O((σ/ν)²).
    if (this.c.asymptotic) {
      return 0
    }
    const { sigma } = this.p
    const { sigma2, nu2, z, eb0, eb1 } = this.c
    const m1 = sigma * Math.sqrt(Math.PI / 2) * ((1 + 2 * z) * eb0 + 2 * z * eb1)
    const m2 = 2 * sigma2 + nu2
    const m3 = sigma2 * sigma * Math.sqrt(2 * Math.PI) * ((1.5 + 6 * z + 4 * z * z) * eb0 + 4 * z * (1 + z) * eb1)
    // E[X⁴]=ν⁴+8ν²σ²+8σ⁴ follows from X²/σ²~noncentral-χ²(2,ν²/σ²).
    const m4 = nu2 * nu2 + 8 * nu2 * sigma2 + 8 * sigma2 * sigma2
    const v = m2 - m1 * m1
    const mu4 = m4 - 4 * m1 * m3 + 6 * m1 * m1 * m2 - 3 * m1 * m1 * m1 * m1
    return mu4 / (v * v) - 3
  }
}
