import Normal from './normal'
import Distribution from './_distribution'
import { erfinv } from '../special'

/**
 * Generator for [Johnson's $S_U$ distribution]{@link https://en.wikipedia.org/wiki/Johnson%27s_SU-distribution}:
 *
 * $f(x; \gamma, \delta, \lambda, \xi) = \frac{\delta}{\lambda \sqrt{2 \pi}} \frac{e^{-\frac{1}{2}\big\[\gamma + \delta \mathrm{sinh}^{-1} z \big\]^2}}{\sqrt{1 + z^2}},$
 *
 * with $\gamma, \xi \in \mathbb{R}$, $\delta, \lambda > 0$ and $z = \frac{x - \xi}{\lambda}$. Support: $x \in \mathbb{R}$.
 *
 * Cumulative distribution function:
 *
 * $F(x; \gamma, \delta, \lambda, \xi) = \Phi\left(\gamma + \delta\sinh^{-1}\left(\frac{x - \xi}{\lambda}\right)\right)$
 *
 * @class JohnsonSU
 * @memberof ran.dist
 * @constructor
 */
export default class JohnsonSU extends Normal {
  // Transformation of normal distribution
  /**
   * @param {number} gamma First location parameter.
   * @param {number} delta First scale parameter.
   * @param {number} lambda Second scale parameter.
   * @param {number} xi Second location parameter.
   */
  constructor (gamma, delta, lambda, xi) {
    super(0, 1)

    // Validate parameters
    this.p = Object.assign(this.p, { gamma, delta, lambda, xi })
    Distribution.validate({ gamma, delta, lambda, xi }, [
      'delta > 0',
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
  }

  _generator () {
    // Direct sampling by transforming normal variate
    return this.p.xi + this.p.lambda * Math.sinh((super._generator() - this.p.gamma) / this.p.delta)
  }

  _pdf (x) {
    const z = (x - this.p.xi) / this.p.lambda
    return this.p.delta * super._pdf(this.p.gamma + this.p.delta * Math.asinh(z)) / (this.p.lambda * Math.sqrt(1 + z * z))
  }

  _cdf (x) {
    return super._cdf(this.p.gamma + this.p.delta * Math.asinh((x - this.p.xi) / this.p.lambda))
  }

  _q (p) {
    return this.p.xi + this.p.lambda * Math.sinh((this.c.sigmaRoot2 * erfinv(2 * p - 1) - this.p.gamma) / this.p.delta)
  }

  static _fitInit (data) {
    // Slifker-Shapiro (1980): cosh(2z/δ)=(m+n)/(2p) gives δ in closed form; back-compute γ,λ,ξ from the same four quantiles
    const n = data.length
    const sorted = data.slice().sort((a, b) => a - b)
    const qfn = p => {
      const idx = p * (sorted.length - 1)
      const lo = Math.floor(idx)
      const hi = Math.ceil(idx)
      return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
    }
    // Four symmetric quantile levels at ±0.5 and ±1.5 standard normal units (z=0.5)
    const y1 = qfn(0.0668072013)
    const y2 = qfn(0.3085375387)
    const y3 = qfn(0.6914624613)
    const y4 = qfn(0.9331927987)
    const m = y4 - y3
    const nq = y2 - y1
    const p = y3 - y2
    const ratio = (m + nq) / (2 * p)
    // When ratio ≤ 1 the extreme sample quantiles are too noisy for the formula; fall back to moments
    if (ratio <= 1 || !Number.isFinite(ratio)) {
      const mean = data.reduce((s, x) => s + x, 0) / n
      const std = Math.sqrt(data.reduce((s, x) => s + (x - mean) ** 2, 0) / n) || 1
      return [0, 1, Math.max(std, 1e-3), mean]
    }
    const delta = 1 / Math.acosh(ratio) // 2z/acosh(ratio) with z=0.5
    const sinh2 = Math.sqrt(ratio * ratio - 1)
    // (m-n)/(2p·sinh₂) = -tanh(γ/δ) from the quantile identity
    const tgam = Math.max(-1 + 1e-9, Math.min(-(m - nq) / (2 * p * sinh2), 1 - 1e-9))
    const gamma = delta * Math.atanh(tgam)
    const sinhZoverD = Math.sinh(0.5 / delta)
    const coshZoverD = Math.cosh(0.5 / delta)
    const lambda = Math.max(p / (2 * Math.cosh(gamma / delta) * sinhZoverD), 1e-3)
    const xi = (y2 + y3) / 2 + lambda * coshZoverD * Math.sinh(gamma / delta)
    return [gamma, Math.max(delta, 1e-3), lambda, xi]
  }
}
