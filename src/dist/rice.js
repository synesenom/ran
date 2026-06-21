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
    this.c = {
      halfNuSqRatio: 0.5 * Math.pow(nu / sigma, 2),
      sigma2: sigma * sigma,
      nuOverSigma2: nu / (sigma * sigma),
      nu2: nu * nu
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
   * @returns {number} σ√(π/2)·L_{1/2}(−t) where t = ν²/(2σ²), evaluated via Bessel I₀/I₁.
   */
  mean () {
    const t = this.c.halfNuSqRatio
    const xi = t / 2
    const i0 = besselI(0, xi)
    if (Number.isFinite(i0)) {
      const e = Math.exp(-xi)
      return this.p.sigma * Math.sqrt(Math.PI / 2) * e * ((1 + t) * i0 + t * besselI(1, xi))
    }
    // Asymptotic: e^{-xi}·I_k(xi) ~ 1/sqrt(2π·xi) for xi >> 1
    return this.p.sigma * Math.sqrt(Math.PI / 2) * (1 + 2 * t) / Math.sqrt(2 * Math.PI * xi)
  }

  /**
   * @returns {number} ν² + 2σ² − mean².
   */
  variance () {
    const m1 = this.mean()
    return this.c.nu2 + 2 * this.c.sigma2 - m1 * m1
  }

  /**
   * @returns {number} Standardised third central moment via L_{1/2} and L_{3/2} Bessel expressions.
   */
  skewness () {
    const t = this.c.halfNuSqRatio
    const xi = t / 2
    const m2 = this.c.nu2 + 2 * this.c.sigma2
    const sigma3 = Math.pow(this.p.sigma, 3)
    const i0 = besselI(0, xi)
    let m1, m3
    if (Number.isFinite(i0)) {
      const e = Math.exp(-xi)
      const ei0 = e * i0
      const ei1 = e * besselI(1, xi)
      m1 = this.p.sigma * Math.sqrt(Math.PI / 2) * ((1 + t) * ei0 + t * ei1)
      // E[R³] = σ³√(2π)·e^{-xi}·[(3/2+3t+t²)·I₀(xi) + t(2+t)·I₁(xi)]
      m3 = sigma3 * Math.sqrt(2 * Math.PI) * ((1.5 + 3 * t + t * t) * ei0 + t * (2 + t) * ei1)
    } else {
      const s = 1 / Math.sqrt(2 * Math.PI * xi)
      m1 = this.p.sigma * Math.sqrt(Math.PI / 2) * (1 + 2 * t) * s
      m3 = sigma3 * Math.sqrt(2 * Math.PI) * (1.5 + 5 * t + 2 * t * t) * s
    }
    const v = m2 - m1 * m1
    return (m3 - 3 * m2 * m1 + 2 * m1 ** 3) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} Excess kurtosis from the first four raw moments.
   */
  kurtosis () {
    const t = this.c.halfNuSqRatio
    const xi = t / 2
    const nu2 = this.c.nu2
    const sig2 = this.c.sigma2
    const m2 = nu2 + 2 * sig2
    // E[R⁴] = ν⁴ + 8ν²σ² + 8σ⁴ (closed form from L₂ Laguerre)
    const m4 = nu2 * nu2 + 8 * nu2 * sig2 + 8 * sig2 * sig2
    const sigma3 = Math.pow(this.p.sigma, 3)
    const i0 = besselI(0, xi)
    let m1, m3
    if (Number.isFinite(i0)) {
      const e = Math.exp(-xi)
      const ei0 = e * i0
      const ei1 = e * besselI(1, xi)
      m1 = this.p.sigma * Math.sqrt(Math.PI / 2) * ((1 + t) * ei0 + t * ei1)
      m3 = sigma3 * Math.sqrt(2 * Math.PI) * ((1.5 + 3 * t + t * t) * ei0 + t * (2 + t) * ei1)
    } else {
      const s = 1 / Math.sqrt(2 * Math.PI * xi)
      m1 = this.p.sigma * Math.sqrt(Math.PI / 2) * (1 + 2 * t) * s
      m3 = sigma3 * Math.sqrt(2 * Math.PI) * (1.5 + 5 * t + 2 * t * t) * s
    }
    const v = m2 - m1 * m1
    return (m4 - 4 * m3 * m1 + 6 * m2 * m1 * m1 - 3 * m1 ** 4) / (v * v) - 3
  }
}
