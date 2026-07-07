import poisson from '../dist/_poisson'
import Process from './_process'

/**
 * Poisson process: a counting process where arrivals in [t, t+Δt] follow Poisson(λ·Δt).
 *
 * The update rule is X_{n+1} = X_n + Poisson(λ·Δt).
 *
 * @class PoissonProcess
 * @memberof ran.process
 * @constructor
 */
export default class PoissonProcess extends Process {
  /**
   * @param {number} [lambda=1] Event rate (must be > 0).
   * @param {number} [dt=1] Time step (must be > 0).
   */
  constructor (lambda = 1, dt = 1) {
    super()
    Process.validate({ lambda, dt }, ['lambda > 0', 'dt > 0'])
    this.p = { lambda, dt }
    this.x = 0
    this.x0 = 0
    this.c = { rate: lambda * dt }
  }

  _next () {
    return this.x + poisson(this.r, this.c.rate)
  }
}
