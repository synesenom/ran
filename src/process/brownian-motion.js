import normal from '../dist/_normal'
import Normal from '../dist/normal'
import Process from './_process'

/**
 * Brownian motion (Wiener process) with drift, using an exact discrete-time sampler.
 *
 * The underlying SDE is
 *
 * $\mathrm{d}X_t = \mu \mathrm{d}t + \sigma \mathrm{d}W_t.$
 *
 * Because the coefficients are constant (state-independent), the Euler–Maruyama step coincides
 * with the exact transition: each increment is an independent draw from
 * $\mathcal{N}(\mu \mathrm{d}t ,\sigma^2 \mathrm{d}t)$, giving the update rule
 *
 * $X_{t+\mathrm{d}t} = X_t + \mu\,\mathrm{d}t + \sigma\sqrt{\mathrm{d}t}\,Z,$
 *
 * where $Z \sim \mathcal{N}(0, 1)$. There is no step-size discretization error.
 *
 * @class BrownianMotion
 * @memberof ran.process
 * @constructor
 */
export default class BrownianMotion extends Process {
  /**
   * @param {number} mu Drift coefficient.
   * @param {number} sigma Diffusion coefficient (must be > 0).
   * @param {number} [dt=1] Time step (must be > 0).
   */
  constructor (mu, sigma, dt = 1) {
    super()
    Process.validate({ mu, sigma, dt }, ['sigma > 0', 'dt > 0'])
    this.p = { mu, sigma, dt }
    this.x = 0
    this.x0 = 0
    this.c = { sqrtDt: Math.sqrt(dt) }
  }

  _next () {
    return this.x + this.p.mu * this.p.dt + this.p.sigma * this.c.sqrtDt * normal(this.r)
  }

  /** @inheritdoc */
  mean (t) {
    if (t < 0) return NaN
    return this.x0 + this.p.mu * t
  }

  /** @inheritdoc */
  variance (t) {
    if (t < 0) return NaN
    return this.p.sigma * this.p.sigma * t
  }

  /** @inheritdoc */
  pdf (x, t) {
    if (t <= 0) return NaN
    const mu = this.x0 + this.p.mu * t
    const sigma = this.p.sigma * Math.sqrt(t)
    const z = (x - mu) / sigma
    return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI))
  }

  /** @inheritdoc */
  covariogram (s, t) {
    if (s < 0 || t < 0) return NaN
    return this.p.sigma * this.p.sigma * Math.min(s, t)
  }

  /** @inheritdoc */
  marginal (t) {
    if (t <= 0) {
      throw Error('BrownianMotion.marginal(): t must be > 0')
    }
    return new Normal(this.mean(t), Math.sqrt(this.variance(t)))
  }

  /**
   * Estimates mu and sigma from an observed path via the exact MLE: increments are i.i.d.
   * Normal(mu*dt, sigma^2*dt), so sample mean/variance of the increments (divided by dt)
   * recovers the parameters to machine precision as the path length grows.
   *
   * @method fit
   * @memberof ran.process.BrownianMotion
   * @param {Array} path Array of observed states (as returned by path()).
   * @param {number} [dt=1] Time step between consecutive path observations (must be > 0).
   * @returns {BrownianMotion} A new instance with estimated mu and sigma.
   * @throws {Error} If path has fewer than 3 states, or if dt is not > 0.
   */
  static fit (path, dt = 1) {
    Process.validate({ dt }, ['dt > 0'])
    if (!Array.isArray(path) || path.length < 3) {
      throw Error('BrownianMotion.fit(): path must contain at least 3 states')
    }
    const n = path.length - 1
    let sum = 0
    for (let i = 0; i < n; i++) sum += path[i + 1] - path[i]
    const meanIncrement = sum / n
    let sq = 0
    for (let i = 0; i < n; i++) {
      const d = path[i + 1] - path[i] - meanIncrement
      sq += d * d
    }
    const varIncrement = sq / (n - 1)
    return new BrownianMotion(meanIncrement / dt, Math.sqrt(varIncrement / dt), dt)
  }
}
