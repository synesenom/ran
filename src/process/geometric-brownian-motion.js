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

  /**
   * Returns the analytical mean of the process at time t.
   *
   * @method mean
   * @memberof ran.process.GeometricBrownianMotion
   * @param {number} t Time.
   * @returns {number} Expected value $e^{\mu t}$.
   */
  mean (t) {
    if (t < 0) return NaN
    return Math.exp(this.p.mu * t)
  }

  /**
   * Returns the analytical variance of the process at time t.
   *
   * @method variance
   * @memberof ran.process.GeometricBrownianMotion
   * @param {number} t Time.
   * @returns {number} Variance $e^{2\mu t}(e^{\sigma^2 t} - 1)$.
   */
  variance (t) {
    if (t < 0) return NaN
    const s2 = this.p.sigma * this.p.sigma
    return Math.exp(2 * this.p.mu * t) * (Math.exp(s2 * t) - 1)
  }
}
