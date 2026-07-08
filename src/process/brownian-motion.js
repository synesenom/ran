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
