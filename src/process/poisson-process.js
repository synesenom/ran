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
  }

  _next () {
    return this.x + poisson(this.r, this.p.lambda * this.p.dt)
  }

  /**
   * Returns the analytical mean of the process at time t.
   *
   * @method mean
   * @memberof ran.process.PoissonProcess
   * @param {number} t Time.
   * @returns {number} Expected value λ·t.
   */
  mean (t) {
    if (t < 0) return NaN
    return this.p.lambda * t
  }

  /**
   * Returns the analytical variance of the process at time t.
   *
   * @method variance
   * @memberof ran.process.PoissonProcess
   * @param {number} t Time.
   * @returns {number} Variance λ·t.
   */
  variance (t) {
    if (t < 0) return NaN
    return this.p.lambda * t
  }

  /**
   * Returns the analytical covariance between process values at times s and t.
   *
   * @method covariogram
   * @memberof ran.process.PoissonProcess
   * @param {number} s First time point.
   * @param {number} t Second time point.
   * @returns {number} Covariance $\lambda \min(s, t)$.
   */
  covariogram (s, t) {
    if (s < 0 || t < 0) return NaN
    return this.p.lambda * Math.min(s, t)
  }
}
