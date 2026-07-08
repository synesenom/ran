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
   * @returns {number} Expected value $x_0 e^{\mu t}$.
   */
  mean (t) {
    if (t < 0) return NaN
    return this.x0 * Math.exp(this.p.mu * t)
  }

  /**
   * Returns the analytical variance of the process at time t.
   *
   * @method variance
   * @memberof ran.process.GeometricBrownianMotion
   * @param {number} t Time.
   * @returns {number} Variance $x_0^2 e^{2\mu t}(e^{\sigma^2 t} - 1)$.
   */
  variance (t) {
    if (t < 0) return NaN
    const s2 = this.p.sigma * this.p.sigma
    return this.x0 * this.x0 * Math.exp(2 * this.p.mu * t) * (Math.exp(s2 * t) - 1)
  }

  /**
   * Returns the marginal probability density of the process at state x and time t.
   * log(X(t)) ~ Normal(log(x₀) + (μ − σ²/2)t, σ²t), so X(t) is log-normally distributed.
   *
   * @method pdf
   * @memberof ran.process.GeometricBrownianMotion
   * @param {number} x State value (must be > 0).
   * @param {number} t Time (must be > 0).
   * @returns {number} Marginal density at (x, t), or NaN for t ≤ 0 or x ≤ 0.
   */
  pdf (x, t) {
    if (t <= 0) return NaN
    if (x <= 0) return 0
    const m = Math.log(this.x0) + (this.p.mu - 0.5 * this.p.sigma * this.p.sigma) * t
    const s = this.p.sigma * Math.sqrt(t)
    const z = (Math.log(x) - m) / s
    return Math.exp(-0.5 * z * z) / (x * s * Math.sqrt(2 * Math.PI))
  }

  /**
   * Returns the analytical covariance between process values at times s and t.
   *
   * @method covariogram
   * @memberof ran.process.GeometricBrownianMotion
   * @param {number} s First time point.
   * @param {number} t Second time point.
   * @returns {number} Covariance $x_0^2 e^{\mu(s+t)}\left(e^{\sigma^2 \min(s,t)} - 1\right)$.
   */
  covariogram (s, t) {
    if (s < 0 || t < 0) return NaN
    const { mu, sigma } = this.p
    const s2 = sigma * sigma
    return this.x0 * this.x0 * Math.exp(mu * (s + t)) * (Math.exp(s2 * Math.min(s, t)) - 1)
  }
}
