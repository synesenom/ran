import normal from '../dist/_normal'
import Process from './_process'

/**
 * Geometric Brownian Motion with drift, using an exact discrete-time sampler.
 *
 * The underlying SDE is
 *
 * $\mathrm{d}X_t = \mu X_t \mathrm{d}t + \sigma X_t \mathrm{d}W_t.$
 *
 * By Itô's formula, $\log X_t$ follows Brownian motion with drift, yielding the closed-form
 * solution $X_t = X_0\exp((\mu - \sigma^2/2)t + \sigma W_t)$. Each step is therefore an
 * independent lognormal draw
 *
 * $X_{t+\mathrm{d}t} = X_t \exp\!\left((\mu - \tfrac{\sigma^2}{2})\,\mathrm{d}t + \sigma\sqrt{\mathrm{d}t}\,Z\right),$
 *
 * where $Z \sim \mathcal{N}(0, 1)$. There is no step-size discretization error.
 *
 * @class GeometricBrownianMotion
 * @memberof ran.process
 * @constructor
 */
export default class GeometricBrownianMotion extends Process {
  /**
   * @param {number} mu Drift rate.
   * @param {number} sigma Volatility (must be > 0).
   * @param {number} [dt=1] Time step (must be > 0).
   */
  constructor (mu, sigma, dt = 1) {
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

  /** @inheritdoc */
  mean (t) {
    if (t < 0) return NaN
    return this.x0 * Math.exp(this.p.mu * t)
  }

  /** @inheritdoc */
  variance (t) {
    if (t < 0) return NaN
    const s2 = this.p.sigma * this.p.sigma
    return this.x0 * this.x0 * Math.exp(2 * this.p.mu * t) * (Math.exp(s2 * t) - 1)
  }

  /** @inheritdoc */
  pdf (x, t) {
    if (t <= 0) return NaN
    if (x <= 0) return 0
    const m = Math.log(this.x0) + (this.p.mu - 0.5 * this.p.sigma * this.p.sigma) * t
    const s = this.p.sigma * Math.sqrt(t)
    const z = (Math.log(x) - m) / s
    return Math.exp(-0.5 * z * z) / (x * s * Math.sqrt(2 * Math.PI))
  }

  /** @inheritdoc */
  covariogram (s, t) {
    if (s < 0 || t < 0) return NaN
    const { mu, sigma } = this.p
    const s2 = sigma * sigma
    return this.x0 * this.x0 * Math.exp(mu * (s + t)) * (Math.exp(s2 * Math.min(s, t)) - 1)
  }
}
