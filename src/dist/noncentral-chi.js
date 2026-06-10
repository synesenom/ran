import { marcumP, besselI, besselISpherical } from '../special'
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
 * Cumulative distribution function:
 *
 * $F(x; k, \lambda) = 1 - Q_{k/2}\!\left(\lambda,\, x\right)$
 *
 * where $Q_M(a, b)$ is the Marcum Q-function.
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
