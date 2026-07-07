import normal from '../dist/_normal'
import Process from './_process'

/**
 * Brownian motion (Wiener process) with drift, using an exact O(1) discrete-time sampler.
 *
 * The update rule per step is X(t + dt) = X(t) + μ·dt + σ·√dt·Z where Z ~ N(0,1).
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
    Process.validate({ sigma, dt }, ['sigma > 0', 'dt > 0'])
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
   * @returns {number} Expected value x₀ + μ·t.
   */
  mean (t) {
    return this.x0 + this.p.mu * t
  }

  /**
   * Returns the analytical variance of the process at time t.
   *
   * @method variance
   * @memberof ran.process.BrownianMotion
   * @param {number} t Time.
   * @returns {number} Variance σ²·t.
   */
  variance (t) {
    return this.p.sigma * this.p.sigma * t
  }
}
