import normal from '../dist/_normal'
import Process from './_process'

/**
 * Brownian motion (Wiener process) with drift, using an exact discrete-time sampler.
 *
 * The underlying SDE is
 *
 * $\mathrm{d}X_t = \mu\,\mathrm{d}t + \sigma\,\mathrm{d}W_t.$
 *
 * Because the coefficients are constant (state-independent), the Euler–Maruyama step coincides
 * with the exact transition: each increment is an independent draw from
 * $\mathcal{N}(\mu\,\mathrm{d}t,\,\sigma^2\,\mathrm{d}t)$, giving the update rule
 *
 * $X(t + \mathrm{d}t) = X(t) + \mu\,\mathrm{d}t + \sigma\sqrt{\mathrm{d}t}\,Z, \quad Z \sim \mathcal{N}(0, 1).$
 *
 * There is no step-size discretization error.
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

  /** @inheritdoc */
  mean (t) {
    if (t < 0) return NaN
    return this.x0 + this.p.mu * t
  }

  /** @inheritdoc */
  variance (t) {
    if (t < 0) return NaN
    return this.p.sigma * this.p.sigma * t
  }

  /** @inheritdoc */
  pdf (x, t) {
    if (t <= 0) return NaN
    const mu = this.x0 + this.p.mu * t
    const sigma = this.p.sigma * Math.sqrt(t)
    const z = (x - mu) / sigma
    return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI))
  }

  /** @inheritdoc */
  covariogram (s, t) {
    if (s < 0 || t < 0) return NaN
    return this.p.sigma * this.p.sigma * Math.min(s, t)
  }
}
