import { marcumP, besselI, besselISpherical, f11, logGamma } from '../special'
import noncentralChi2 from './_noncentral-chi2'
import Distribution from './_distribution'
import NoncentralChi2 from './noncentral-chi2'

/**
 * Probability density function for the [non-central $\chi$ distribution]{@link https://en.wikipedia.org/wiki/Noncentral_chi_distribution}:
 *
 * $f(x; k; \lambda) = \frac{x^k \lambda}{(\lambda x)^{k/2}} e^{-\frac{x^2 + \lambda^2}{2}} I_{k/2 - 1}(\lambda x),$
 *
 * with $k \in \mathbb{N}^+$, $\lambda > 0$ and $I_n(x)$ is the modified Bessel function of the first kind with order $n$. Support: $x \in [0, \infty)$.
 *
 * @class NoncentralChi
 * @memberof ran.dist
 * @constructor
 */
export default class NoncentralChi extends NoncentralChi2 {
  // Transformation of non-central chi2 distribution
  /**
   * @param {number} k Degrees of freedom. If not an integer, it is rounded to the nearest one.
   * @param {number} lambda Non-centrality parameter.
   */
  constructor (k, lambda) {
    const ki = Math.round(k)
    super(ki, lambda * lambda)

    // Validate parameters
    Distribution.validate({ k: ki, lambda }, [
      'lambda > 0'
    ])

    // Override p to expose user-facing lambda; super stored lambda²
    this.p = { k: ki, lambda }
    // Store lambda² for internal delegation to NoncentralChi2 logic
    Object.assign(this.c, { lambda2: lambda * lambda })

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]
  }

  // Odd raw moment mu'_j = 2^(j/2)·Γ((k+j)/2)/Γ(k/2)·1F1(-j/2; k/2; -h), h = lambda²/2, evaluated
  // through the Kummer transform 1F1(a; b; -h) = e^(-h)·1F1(b-a; b; h) so the series has
  // all-positive terms (no cancellation); even raw moments are polynomials inlined by the callers
  _rawOdd (j) {
    const { k } = this.p
    const h = this.c.lambda2 / 2
    return Math.pow(2, j / 2) * Math.exp(logGamma((k + j) / 2) - logGamma(k / 2) - h) * f11((k + j) / 2, k / 2, h)
  }

  // Moment overrides shadow NoncentralChi2's: the inherited polynomials would describe the
  // chi-squared variate, not its square root. All moments are finite for every valid (k, lambda).
  // See solutions/correctness/2026-06-11-1345-moment-override-inheritance-shadowing.md
  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return this._rawOdd(1)
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const m = this._rawOdd(1)
    return this.p.k + this.c.lambda2 - m * m
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const r1 = this._rawOdd(1)
    const r2 = this.p.k + this.c.lambda2
    const r3 = this._rawOdd(3)
    const v = r2 - r1 * r1
    return (r3 - 3 * r1 * r2 + 2 * r1 * r1 * r1) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const { k } = this.p
    const lambda2 = this.c.lambda2
    const r1 = this._rawOdd(1)
    const r2 = k + lambda2
    const r3 = this._rawOdd(3)
    const r4 = r2 * r2 + 2 * (k + 2 * lambda2)
    const v = r2 - r1 * r1
    return (r4 - 4 * r1 * r3 + 6 * r1 * r1 * r2 - 3 * r1 * r1 * r1 * r1) / (v * v) - 3
  }

  _generator () {
    return Math.sqrt(noncentralChi2(this.r, this.p.k, this.c.lambda2))
  }

  _pdf (x) {
    if (x === 0) {
      return 0
    }
    const x2 = x * x
    const lambda2 = this.c.lambda2
    if (this.c.kIsEven) {
      return x * Math.exp(-0.5 * (x2 + lambda2) + (this.p.k / 4 - 0.5) * Math.log(x2 / lambda2)) * besselI(Math.round(this.p.k / 2) - 1, Math.sqrt(lambda2 * x2))
    } else {
      return x * Math.exp(-0.5 * (x2 + lambda2)) * Math.pow(x2 / lambda2, this.p.k / 4 - 0.5) * besselISpherical(Math.floor((this.p.k - 3) / 2), Math.sqrt(lambda2 * x2)) * Math.sqrt(2 * Math.sqrt(x2 * lambda2) / Math.PI)
    }
  }

  _cdf (x) {
    return marcumP(this.p.k / 2, this.c.lambda2 / 2, x * x / 2)
  }

  static _fitInit (data) {
    // E[X²]=k+λ²; estimate E[X²]≈mean²+variance — see solutions/distribution/2026-05-28-1902-noncentral-fitinit-mom-stability.md
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1
    const half = Math.max(1, (mean * mean + variance) / 2)
    return [Math.max(1, Math.round(half)), Math.max(1e-3, Math.sqrt(half))]
  }
}
