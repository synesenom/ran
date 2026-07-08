import normal from '../dist/_normal'
import Process from './_process'

/**
 * Geometric Brownian Motion with drift, using an exact discrete-time sampler.
 *
 * The update rule per step is
 *
 * $X(t + \mathrm{d}t) = X(t)\,\exp\!\left((\mu - \tfrac{\sigma^2}{2})\,\mathrm{d}t + \sigma\sqrt{\mathrm{d}t}\,Z\right), \quad Z \sim \mathcal{N}(0, 1).$
 *
 * @class GeometricBrownianMotion
 * @memberof ran.process
 * @constructor
 */
export default class GeometricBrownianMotion extends Process {
  /**
   * @param {number} [mu=0] Drift rate.
   * @param {number} [sigma=1] Volatility (must be > 0).
   * @param {number} [dt=1] Time step (must be > 0).
   */
  constructor (mu = 0, sigma = 1, dt = 1) {
    super()
    Process.validate({ mu, sigma, dt }, ['sigma > 0', 'dt > 0'])
    this.p = { mu, sigma, dt }
    this.x = 1
    this.x0 = 1
    this.c = {
      drift: (mu - 0.5 * sigma * sigma) * dt,
      noise: sigma * Math.sqrt(dt)
    }
  }

  _next () {
    return this.x * Math.exp(this.c.drift + this.c.noise * normal(this.r))
  }

  mean (t) {
    if (t < 0) return NaN
    return this.x0 * Math.exp(this.p.mu * t)
  }

  variance (t) {
    if (t < 0) return NaN
    const s2 = this.p.sigma * this.p.sigma
    return this.x0 * this.x0 * Math.exp(2 * this.p.mu * t) * (Math.exp(s2 * t) - 1)
  }

  pdf (x, t) {
    if (t <= 0) return NaN
    if (x <= 0) return 0
    const m = Math.log(this.x0) + (this.p.mu - 0.5 * this.p.sigma * this.p.sigma) * t
    const s = this.p.sigma * Math.sqrt(t)
    const z = (Math.log(x) - m) / s
    return Math.exp(-0.5 * z * z) / (x * s * Math.sqrt(2 * Math.PI))
  }

  covariogram (s, t) {
    if (s < 0 || t < 0) return NaN
    const { mu, sigma } = this.p
    const s2 = sigma * sigma
    return this.x0 * this.x0 * Math.exp(mu * (s + t)) * (Math.exp(s2 * Math.min(s, t)) - 1)
  }
}
