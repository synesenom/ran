import normal from '../dist/_normal'
import Process from './_process'

/**
 * Brownian bridge process conditioned to return to 0 at time T, using an exact discrete-time sampler.
 *
 * The underlying SDE is
 *
 * $\mathrm{d}X_t = -\frac{X_t}{T - t} \mathrm{d}t + \sigma \mathrm{d}W_t.$
 *
 * Because the SDE is linear, the conditional distribution $X_{t+\mathrm{d}t} \mid X_t = x, X_T = 0$
 * is Gaussian, derived from the covariance structure of the Wiener process. The sampler draws
 * from that distribution directly
 *
 * $X_{t+\mathrm{d}t} = X_t \frac{T - t - \mathrm{d}t}{T - t} + \sigma\sqrt{\frac{\mathrm{d}t (T - t - \mathrm{d}t)}{T - t}}\,Z,$
 *
 * where $Z \sim \mathcal{N}(0, 1)$. There is no step-size discretization error. The process pins to 0 at step $N = T/\mathrm{d}t$.
 *
 * @class BrownianBridge
 * @memberof ran.process
 * @constructor
 */
export default class BrownianBridge extends Process {
  /**
   * @param {number} sigma Volatility (must be > 0).
   * @param {number} T Terminal time (must be > 0).
   * @param {number} [dt=0.1] Time step (must be > 0; T/dt must be a positive integer).
   */
  constructor (sigma, T, dt = 0.1) {
    super()
    Process.validate({ sigma, T, dt }, ['sigma > 0', 'T > 0', 'dt > 0'])
    this.p = { sigma, T, dt }
    this.n = 0
    this.x = 0
    this.x0 = 0
    this.c = {
      N: Math.round(T / dt)
    }
  }

  _next () {
    const { sigma, T, dt } = this.p
    const { N } = this.c
    // Pin to 0 at the terminal step: the exact variance collapses to 0 here anyway,
    // but computing sqrt of a near-zero ratio risks floating-point noise at the endpoint.
    if (this.n >= N - 1) {
      this.n++
      return 0
    }
    const t = this.n * dt
    this.n++
    const remaining = T - t
    const ratio = (remaining - dt) / remaining
    return this.x * ratio + sigma * Math.sqrt(dt * ratio) * normal(this.r)
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
