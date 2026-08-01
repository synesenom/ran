import normal from '../dist/_normal'
import LogNormal from '../dist/log-normal'
import Process from './_process'

/**
 * Geometric Brownian Motion with drift, using an exact discrete-time sampler.
 *
 * The underlying SDE is
 *
 * $\mathrm{d}X_t = \mu X_t \mathrm{d}t + \sigma X_t \mathrm{d}W_t.$
 *
 * By Itô's formula, $\log X_t$ follows Brownian motion with drift, yielding the closed-form
 * solution $X_t = X_0\exp((\mu - \sigma^2/2)t + \sigma W_t)$. Each step is therefore an
 * independent lognormal draw
 *
 * $X_{t+\mathrm{d}t} = X_t \exp\!\left((\mu - \tfrac{\sigma^2}{2})\,\mathrm{d}t + \sigma\sqrt{\mathrm{d}t}\,Z\right),$
 *
 * where $Z \sim \mathcal{N}(0, 1)$. There is no step-size discretization error.
 *
 * @class GeometricBrownianMotion
 * @memberof ran.process
 * @constructor
 */
export default class GeometricBrownianMotion extends Process {
  /**
   * @param {number} mu Drift rate.
   * @param {number} sigma Volatility (must be > 0).
   * @param {number} [dt=1] Time step (must be > 0).
   */
  constructor (mu, sigma, dt = 1) {
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
   * log(X_{i+1}/X_i) | X_i is Normal(drift, noise^2), the same law _next() draws from; the
   * transition density in X_{i+1} itself picks up a 1/X_{i+1} Jacobian term. Mirrors pdf(x,t)'s
   * x <= 0 => 0 convention: the log-density of an impossible (non-positive) state is -Infinity,
   * not a thrown error (decisions/0015-return-value-and-error-conventions.md).
   *
   * @method _transitionLnPdf
   * @memberof ran.process.GeometricBrownianMotion
   * @param {number} xPrev State at the start of the step.
   * @param {number} xNext State at the end of the step.
   * @returns {number} Log-density of the transition xPrev -> xNext, or -Infinity if xNext <= 0.
   * @protected
   * @ignore
   */
  _transitionLnPdf (xPrev, xNext) {
    if (xNext <= 0) {
      return -Infinity
    }
    const { drift, noise } = this.c
    const z = (Math.log(xNext / xPrev) - drift) / noise
    return -0.5 * z * z - Math.log(noise) - 0.5 * Math.log(2 * Math.PI) - Math.log(xNext)
  }

  /** @inheritdoc */
  mean (t) {
    if (t < 0) return NaN
    return this.x0 * Math.exp(this.p.mu * t)
  }

  /** @inheritdoc */
  variance (t) {
    if (t < 0) return NaN
    const s2 = this.p.sigma * this.p.sigma
    return this.x0 * this.x0 * Math.exp(2 * this.p.mu * t) * (Math.exp(s2 * t) - 1)
  }

  /** @inheritdoc */
  pdf (x, t) {
    if (t <= 0) return NaN
    if (x <= 0) return 0
    const m = Math.log(this.x0) + (this.p.mu - 0.5 * this.p.sigma * this.p.sigma) * t
    const s = this.p.sigma * Math.sqrt(t)
    const z = (Math.log(x) - m) / s
    return Math.exp(-0.5 * z * z) / (x * s * Math.sqrt(2 * Math.PI))
  }

  /** @inheritdoc */
  covariogram (s, t) {
    if (s < 0 || t < 0) return NaN
    const { mu, sigma } = this.p
    const s2 = sigma * sigma
    return this.x0 * this.x0 * Math.exp(mu * (s + t)) * (Math.exp(s2 * Math.min(s, t)) - 1)
  }

  /** @inheritdoc */
  marginal (t) {
    if (t <= 0) {
      throw Error('GeometricBrownianMotion.marginal(): t must be > 0')
    }
    // log(X_t) is Normal(m, s); LogNormal(mu, sigma) parameterizes exactly that underlying normal.
    const m = Math.log(this.x0) + (this.p.mu - 0.5 * this.p.sigma * this.p.sigma) * t
    const s = this.p.sigma * Math.sqrt(t)
    return new LogNormal(m, s)
  }

  /**
   * Estimates mu and sigma from an observed path via the exact MLE: log-returns are i.i.d.
   * Normal((mu-sigma^2/2)*dt, sigma^2*dt) by Ito's lemma, so sample mean/variance of the
   * log-returns (divided by dt) recovers the parameters to machine precision as the path
   * length grows.
   *
   * @method fit
   * @memberof ran.process.GeometricBrownianMotion
   * @param {Array} path Array of observed states (as returned by path()); every value must be > 0.
   * @param {number} [dt=1] Time step between consecutive path observations (must be > 0).
   * @returns {GeometricBrownianMotion} A new instance with estimated mu and sigma.
   * @throws {Error} If path has fewer than 3 states, contains a non-positive state, or if dt is not > 0.
   */
  static fit (path, dt = 1) {
    Process.validate({ dt }, ['dt > 0'])
    if (!Array.isArray(path) || path.length < 3) {
      throw Error('GeometricBrownianMotion.fit(): path must contain at least 3 states')
    }
    if (path.some(x => x <= 0)) {
      throw Error('GeometricBrownianMotion.fit(): path must contain only positive states')
    }
    const n = path.length - 1
    let sum = 0
    for (let i = 0; i < n; i++) sum += Math.log(path[i + 1] / path[i])
    const meanLogReturn = sum / n
    let sq = 0
    for (let i = 0; i < n; i++) {
      const d = Math.log(path[i + 1] / path[i]) - meanLogReturn
      sq += d * d
    }
    const varLogReturn = sq / (n - 1)
    const sigma = Math.sqrt(varLogReturn / dt)
    const mu = meanLogReturn / dt + sigma * sigma / 2
    return new GeometricBrownianMotion(mu, sigma, dt)
  }
}
