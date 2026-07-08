import poisson from '../dist/_poisson'
import logGamma from '../special/log-gamma'
import Process from './_process'

/**
 * Poisson process: a counting process of independent arrivals at rate $\lambda$, using an exact
 * discrete-time sampler.
 *
 * By the independent-increments property, the number of arrivals in any interval of length
 * $\mathrm{d}t$ is exactly $\mathrm{Poisson}(\lambda\,\mathrm{d}t)$, independent of all other
 * intervals. The sampler draws that count directly
 *
 * $X(t + \mathrm{d}t) = X(t) + K, \quad K \sim \mathrm{Poisson}(\lambda\,\mathrm{d}t),$
 *
 * with no step-size discretization error.
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
