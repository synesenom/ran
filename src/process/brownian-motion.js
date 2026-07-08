import normal from '../dist/_normal'
import Process from './_process'

/**
 * Brownian motion (Wiener process) with drift, using an exact O(1) discrete-time sampler.
 *
 * The update rule per step is
 *
 * $X(t + \mathrm{d}t) = X(t) + \mu\,\mathrm{d}t + \sigma\sqrt{\mathrm{d}t}\,Z,$
 *
 * where $Z \sim \mathcal{N}(0, 1)$.
 *
 * @class BrownianMotion
 * @memberof ran.process
 * @constructor
 */
export default class BrownianMotion extends Process {
  /**
   * @param {number} [mu=0] Drift coefficient.
   * @param {number} [sigma=1] Diffusion coefficient (must be > 0).
   * @param {number} [dt=1] Time step (must be > 0).
   */
  constructor (mu = 0, sigma = 1, dt = 1) {
    super()
    Process.validate({ mu, sigma, dt }, ['sigma > 0', 'dt > 0'])
    this.p = { mu, sigma, dt }
    this.x = 0
    this.x0 = 0
    this.c = { sqrtDt: Math.sqrt(dt) }
  }

  _next () {
    return this.x + this.p.mu * this.p.dt + this.p.sigma * this.c.sqrtDt * normal(this.r)
  }

  /**
   * Returns the analytical mean of the process at time t.
   *
   * @method mean
   * @memberof ran.process.BrownianMotion
   * @param {number} t Time.
   * @returns {number} Expected value $x_0 + \mu t$.
   */
  mean (t) {
    if (t < 0) return NaN
    return this.x0 + this.p.mu * t
  }

  /**
   * Returns the analytical variance of the process at time t.
   *
   * @method variance
   * @memberof ran.process.BrownianMotion
   * @param {number} t Time.
   * @returns {number} Variance $\sigma^2 t$.
   */
  variance (t) {
    if (t < 0) return NaN
    return this.p.sigma * this.p.sigma * t
  }

  /**
   * Returns the marginal probability density of the process at state x and time t.
   * X(t) ~ Normal(x₀ + μt, σ²t).
   *
   * @method pdf
   * @memberof ran.process.BrownianMotion
   * @param {number} x State value.
   * @param {number} t Time (must be > 0).
   * @returns {number} Marginal density at (x, t), or NaN for t ≤ 0.
   */
  pdf (x, t) {
    if (t <= 0) return NaN
    const mu = this.x0 + this.p.mu * t
    const sigma = this.p.sigma * Math.sqrt(t)
    const z = (x - mu) / sigma
    return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI))
  }

  /**
   * Returns the analytical covariance between process values at times s and t.
   *
   * @method covariogram
   * @memberof ran.process.BrownianMotion
   * @param {number} s First time point.
   * @param {number} t Second time point.
   * @returns {number} Covariance $\sigma^2 \min(s, t)$.
   */
  covariogram (s, t) {
    if (s < 0 || t < 0) return NaN
    return this.p.sigma * this.p.sigma * Math.min(s, t)
  }
}
