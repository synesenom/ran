import poisson from '../dist/_poisson'
import logGamma from '../special/log-gamma'
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

  /** @inheritdoc */
  mean (t) {
    if (t < 0) return NaN
    return this.p.lambda * t
  }

  /** @inheritdoc */
  variance (t) {
    if (t < 0) return NaN
    return this.p.lambda * t
  }

  /** @inheritdoc */
  pdf (x, t) {
    if (t < 0) return NaN
    if (!Number.isInteger(x) || x < 0) return 0
    if (t === 0) return x === 0 ? 1 : 0
    const lt = this.p.lambda * t
    return Math.exp(-lt + x * Math.log(lt) - logGamma(x + 1))
  }

  /** @inheritdoc */
  covariogram (s, t) {
    if (s < 0 || t < 0) return NaN
    return this.p.lambda * Math.min(s, t)
  }
}
