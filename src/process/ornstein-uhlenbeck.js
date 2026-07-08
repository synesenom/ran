import normal from '../dist/_normal'
import Process from './_process'

/**
 * Ornstein-Uhlenbeck mean-reverting process, using an exact discrete-time sampler.
 *
 * The update rule per step is
 *
 * $X(t + \mathrm{d}t) = X(t)\,e^{-\theta\,\mathrm{d}t} + \mu\!\left(1 - e^{-\theta\,\mathrm{d}t}\right) + \sigma\sqrt{\frac{1 - e^{-2\theta\,\mathrm{d}t}}{2\theta}}\,Z,$
 *
 * where $Z \sim \mathcal{N}(0, 1)$.
 *
 * @class OrnsteinUhlenbeck
 * @memberof ran.process
 * @constructor
 */
export default class OrnsteinUhlenbeck extends Process {
  /**
   * @param {number} [theta=1] Mean-reversion speed (must be > 0).
   * @param {number} [mu=0] Long-run mean.
   * @param {number} [sigma=1] Diffusion coefficient (must be > 0).
   * @param {number} [dt=1] Time step (must be > 0).
   */
  constructor (theta = 1, mu = 0, sigma = 1, dt = 1) {
    super()
    Process.validate({ theta, mu, sigma, dt }, ['theta > 0', 'sigma > 0', 'dt > 0'])
    this.p = { theta, mu, sigma, dt }
    this.x = 0
    this.x0 = 0
    const decay = Math.exp(-theta * dt)
    this.c = {
      decay,
      noise: sigma * Math.sqrt((1 - decay * decay) / (2 * theta))
    }
  }

  _next () {
    const { mu } = this.p
    const { decay, noise } = this.c
    return this.x * decay + mu * (1 - decay) + noise * normal(this.r)
  }

  /** @inheritdoc */
  mean (t) {
    if (t < 0) return NaN
    const e = Math.exp(-this.p.theta * t)
    return this.x0 * e + this.p.mu * (1 - e)
  }

  /** @inheritdoc */
  variance (t) {
    if (t < 0) return NaN
    return this.p.sigma * this.p.sigma * (1 - Math.exp(-2 * this.p.theta * t)) / (2 * this.p.theta)
  }

  /** @inheritdoc */
  pdf (x, t) {
    if (t <= 0) return NaN
    const mu = this.mean(t)
    const sigma = Math.sqrt(this.variance(t))
    const z = (x - mu) / sigma
    return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI))
  }

  /** @inheritdoc */
  covariogram (s, t) {
    if (s < 0 || t < 0) return NaN
    const { theta, sigma } = this.p
    return (sigma * sigma / (2 * theta)) * (Math.exp(-theta * Math.abs(t - s)) - Math.exp(-theta * (t + s)))
  }
}
