import Normal from './normal'
import Distribution from './_distribution'
import { erfc, erfinv } from '../special'
import normal from './_normal'

/**
 * Generator for [Johnson's $S_B$ distribution]{@link https://en.wikipedia.org/wiki/Johnson%27s_SU-distribution#Johnson's_SB-distribution}:
 *
 * $f(x; \gamma, \delta, \lambda, \xi) = \frac{\delta \lambda}{\sqrt{2 \pi} z (\lambda - z)} e^{-\frac{1}{2}\big\[\gamma + \delta \ln \frac{z}{\lambda - z}\big\]^2},$
 *
 * with $\gamma, \xi \in \mathbb{R}$, $\delta, \lambda > 0$ and $z = x - \xi$. Support: $x \in (\xi, \xi + \lambda)$.
 *
 * @class JohnsonSB
 * @memberof ran.dist
 * @constructor
 */
export default class JohnsonSB extends Normal {
  // Transformation of normal distribution
  /**
   * @param {number} gamma First location parameter.
   * @param {number} delta First scale parameter.
   * @param {number} lambda Second scale parameter.
   * @param {number} xi Second location parameter.
   */
  constructor (gamma, delta, lambda, xi) {
    super(0, 1)

    // JohnsonSB has 4 free parameters (gamma, delta, lambda, xi); override the 2 inherited from Normal
    // solutions/distribution/2026-06-07-2138-continuous-subclass-natural-params.md
    this.k = 4

    // Validate parameters
    // decisions/0018-continuous-subclass-natural-params.md — natural params only in this.p;
    // mu/sigma leaked from Normal(0,1) are dropped
    this.p = { gamma, delta, lambda, xi }
    Distribution.validate({ gamma, delta, lambda, xi }, [
      'delta > 0',
      'lambda > 0'
    ])

    // Set support
    this.s = [{
      value: xi,
      closed: false
    }, {
      value: xi + lambda,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling by transforming a standard normal variate
    return this.p.xi + this.p.lambda / (1 + Math.exp(-(normal(this.r, 0, 1) - this.p.gamma) / this.p.delta))
  }

  _pdf (x) {
    // Standard-normal density inlined (Normal.prototype._pdf read this.p.mu/this.p.sigma, no longer set)
    const z = x - this.p.xi
    const z2 = this.p.gamma + this.p.delta * Math.log(z / (this.p.lambda - z))
    return this.p.delta * this.p.lambda * (Math.exp(-0.5 * z2 * z2) / this.c.sigmaRoot2Pi) / (z * (this.p.lambda - z))
  }

  _cdf (x) {
    // Standard-normal CDF inlined (Normal.prototype._cdf read this.p.mu/this.p.sigma, no longer set)
    const z = x - this.p.xi
    const lnz = Math.log(z / (this.p.lambda - z))
    return Number.isFinite(lnz) ? 0.5 * erfc(-(this.p.gamma + this.p.delta * lnz) / this.c.sigmaRoot2) : 0
  }

  _q (p) {
    return this.p.xi + this.p.lambda / (1 + Math.exp(-(this.c.sigmaRoot2 * erfinv(2 * p - 1) - this.p.gamma) / this.p.delta))
  }

  /**
   * @returns {number} Mean of the distribution.
   */
  mean () {
    return this._numericalRawMoment(1)
  }

  /**
   * @returns {number} Variance of the distribution.
   */
  variance () {
    const m1 = this._numericalRawMoment(1)
    const m2 = this._numericalRawMoment(2)
    const v = m2 - m1 * m1
    return v < 0 ? 0 : v
  }

  /**
   * @returns {number} Skewness of the distribution.
   */
  skewness () {
    const m1 = this._numericalRawMoment(1)
    const m2 = this._numericalRawMoment(2)
    const m3 = this._numericalRawMoment(3)
    const v = m2 - m1 * m1
    if (!(v > 0)) return NaN
    return (m3 - 3 * m1 * m2 + 2 * Math.pow(m1, 3)) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} Excess kurtosis of the distribution.
   */
  kurtosis () {
    const m1 = this._numericalRawMoment(1)
    const m2 = this._numericalRawMoment(2)
    const m3 = this._numericalRawMoment(3)
    const m4 = this._numericalRawMoment(4)
    const v = m2 - m1 * m1
    if (!(v > 0)) return NaN
    return (m4 - 4 * m1 * m3 + 6 * m1 * m1 * m2 - 3 * Math.pow(m1, 4)) / (v * v) - 3
  }

  static _fitInit (data) {
    // Slifker-Shapiro (1980): logit of (y_k-ξ)/λ is linear in the standard normal quantile; OLS on 4 symmetric quantiles gives γ,δ
    const sorted = data.slice().sort((a, b) => a - b)
    const q = p => {
      const idx = p * (sorted.length - 1)
      const lo = Math.floor(idx)
      const hi = Math.ceil(idx)
      return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
    }
    const y1 = q(0.0668072013)
    const y2 = q(0.3085375387)
    const y3 = q(0.6914624613)
    const y4 = q(0.9331927987)
    // Extend slightly beyond observed extremes so logits are finite and numerically stable
    const range = sorted[sorted.length - 1] - sorted[0]
    const buf = Math.max(0.05 * range, 1e-6)
    const xi = sorted[0] - buf
    const lambda = range + 2 * buf
    const logit = x => Math.log(x / (1 - x))
    const l1 = logit((y1 - xi) / lambda)
    const l2 = logit((y2 - xi) / lambda)
    const l3 = logit((y3 - xi) / lambda)
    const l4 = logit((y4 - xi) / lambda)
    // OLS slope: Σz_k*l_k / Σz_k² with z_k∈{-1.5,-0.5,0.5,1.5}, Σz_k=0, Σz_k²=5
    const slope = (-1.5 * l1 - 0.5 * l2 + 0.5 * l3 + 1.5 * l4) / 5
    const delta = Math.max(1 / slope, 1e-3)
    const gamma = -((l1 + l2 + l3 + l4) / 4) * delta
    return [gamma, delta, lambda, xi]
  }
}
