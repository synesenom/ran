import normal from '../dist/_normal'
import Normal from '../dist/normal'
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

  /** @inheritdoc */
  marginal (t) {
    // Variance collapses to 0 at t=0 (fixed start) and t=T (pinned end), where the marginal
    // is a point mass rather than a Normal distribution — outside what Normal can represent.
    if (t <= 0 || t >= this.p.T) {
      throw Error('BrownianBridge.marginal(): t must satisfy 0 < t < T')
    }
    return new Normal(0, Math.sqrt(this.variance(t)))
  }

  /**
   * Estimates sigma from an observed path via the exact MLE. Unlike BrownianMotion/
   * OrnsteinUhlenbeck/CoxIngersollRoss, T is a given/fixed endpoint (the bridge is conditioned
   * to return to 0 at T), not something to estimate from data — so it is a required argument,
   * mirroring the constructor. Each step's conditional variance is known exactly from _next()'s
   * own formula (sigma^2 * dt * ratio, ratio = (remaining-dt)/remaining), leaving sigma as the
   * only free scale parameter: Y_i = X_{i+1} - X_i*ratio_i is exactly sigma*sqrt(dt*ratio_i)*Z_i,
   * so sigma^2's MLE is the mean of Y_i^2/(dt*ratio_i) over all non-degenerate steps. The final
   * step (i = N-1) is excluded because _next() pins it to exactly 0 (ratio = 0), carrying no
   * information about sigma.
   *
   * @method fit
   * @memberof ran.process.BrownianBridge
   * @param {Array} path Array of observed states (as returned by path()).
   * @param {number} T Terminal time (must be > 0), matching the constructor's T.
   * @param {number} [dt=0.1] Time step (must be > 0; T/dt must be a positive integer).
   * @returns {BrownianBridge} A new instance with estimated sigma.
   * @throws {Error} If T or dt is not > 0, if T/dt is not at least 2, or if path does not
   * contain exactly T/dt + 1 states.
   */
  static fit (path, T, dt = 0.1) {
    Process.validate({ T, dt }, ['T > 0', 'dt > 0'])
    const N = Math.round(T / dt)
    if (N < 2) {
      throw Error('BrownianBridge.fit(): T/dt must be at least 2 to have an estimable step')
    }
    if (!Array.isArray(path) || path.length !== N + 1) {
      throw Error('BrownianBridge.fit(): path must contain exactly T/dt + 1 states')
    }
    let ss = 0
    for (let i = 0; i < N - 1; i++) {
      const remaining = T - i * dt
      const ratio = (remaining - dt) / remaining
      const e = path[i + 1] - path[i] * ratio
      ss += e * e / (dt * ratio)
    }
    const sigma2 = ss / (N - 1)
    return new BrownianBridge(Math.sqrt(sigma2), T, dt)
  }
}
