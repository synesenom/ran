import normal from '../dist/_normal'
import Process from './_process'

/**
 * Brownian bridge process conditioned to return to 0 at time T.
 *
 * The update rule per step is
 *
 * $X_{n+1} = X_n + \frac{0 - X_n}{T - n\,\mathrm{d}t}\,\mathrm{d}t + \sigma\sqrt{\mathrm{d}t}\,Z,$
 *
 * where $Z \sim \mathcal{N}(0, 1)$. The process pins to 0 at step $N = T/\mathrm{d}t$.
 *
 * @class BrownianBridge
 * @memberof ran.process
 * @constructor
 */
export default class BrownianBridge extends Process {
  /**
   * @param {number} [sigma=1] Volatility (must be > 0).
   * @param {number} [T=1] Terminal time (must be > 0).
   * @param {number} [dt=0.1] Time step (must be > 0; T/dt must be a positive integer).
   */
  constructor (sigma = 1, T = 1, dt = 0.1) {
    super()
    Process.validate({ sigma, T, dt }, ['sigma > 0', 'T > 0', 'dt > 0'])
    this.p = { sigma, T, dt }
    this.n = 0
    this.x = 0
    this.x0 = 0
    this.c = {
      sqrtDt: Math.sqrt(dt),
      N: Math.round(T / dt)
    }
  }

  _next () {
    const { sigma, T, dt } = this.p
    const { sqrtDt, N } = this.c
    // Pin to 0 at the terminal step instead of applying the formula (which would
    // blow up as T - t → 0 and leave residual noise at the endpoint).
    if (this.n >= N - 1) {
      this.n++
      return 0
    }
    const t = this.n * dt
    this.n++
    return this.x + (-this.x / (T - t)) * dt + sigma * sqrtDt * normal(this.r)
  }

  /** @inheritdoc */
  reset () {
    super.reset()
    this.n = 0
  }

  /** @inheritdoc */
  path (n) {
    const savedN = this.n
    this.n = 0
    const result = super.path(n)
    this.n = savedN
    return result
  }

  /** @inheritdoc */
  mean (t) {
    if (t < 0) return NaN
    return 0
  }

  /** @inheritdoc */
  variance (t) {
    if (t < 0) return NaN
    if (t >= this.p.T) return 0
    return this.p.sigma * this.p.sigma * t * (this.p.T - t) / this.p.T
  }

  /** @inheritdoc */
  covariogram (s, t) {
    if (s < 0 || t < 0) return NaN
    if (s > this.p.T || t > this.p.T) return 0
    return this.p.sigma * this.p.sigma * Math.min(s, t) * (this.p.T - Math.max(s, t)) / this.p.T
  }

  /** @inheritdoc */
  pdf (x, t) {
    if (t < 0) return NaN
    const v = this.variance(t)
    if (v === 0) return x === 0 ? Infinity : 0
    const sigma = Math.sqrt(v)
    const z = x / sigma
    return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI))
  }
}
