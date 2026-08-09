import normal from '../dist/_normal'
import Normal from '../dist/normal'
import Process from './_process'
import ols from './_ols'

/**
 * Ornstein-Uhlenbeck mean-reverting process, using an exact discrete-time sampler.
 *
 * The underlying SDE is
 *
 * $\mathrm{d}X_t = \theta(\mu - X_t) \mathrm{d}t + \sigma \mathrm{d}W_t.$
 *
 * Because the SDE is linear, $X_{t+\mathrm{d}t} \mid X_t$ is Gaussian with closed-form mean and
 * variance. The sampler draws from that distribution directly
 *
 * $X_{t+\mathrm{d}t} = X_t\,e^{-\theta\,\mathrm{d}t} + \mu\left(1 - e^{-\theta\,\mathrm{d}t}\right) + \sigma\sqrt{\frac{1 - e^{-2\theta\,\mathrm{d}t}}{2\theta}}\,Z,$
 *
 * where $Z \sim \mathcal{N}(0, 1)$. There is no step-size discretization error regardless of $\mathrm{d}t$.
 *
 * @class OrnsteinUhlenbeck
 * @memberof ran.process
 * @constructor
 */
export default class OrnsteinUhlenbeck extends Process {
  /**
   * @param {number} theta Mean-reversion speed (must be > 0).
   * @param {number} mu Long-run mean.
   * @param {number} sigma Diffusion coefficient (must be > 0).
   * @param {number} [dt=1] Time step (must be > 0).
   */
  constructor (theta, mu, sigma, dt = 1) {
    super()
    Process.validate({ theta, mu, sigma, dt }, ['theta > 0', 'sigma > 0', 'dt > 0'])
    this.p = { theta, mu, sigma, dt }
    this.x = 0
    this.x0 = 0
    const decay = Math.exp(-theta * dt)
    const noise = sigma * Math.sqrt((1 - decay * decay) / (2 * theta))
    this.c = { decay, noise, logNoise: Math.log(noise) }
  }

  _next () {
    const { mu } = this.p
    const { decay, noise } = this.c
    return this.x * decay + mu * (1 - decay) + noise * normal(this.r)
  }

  /**
   * The one-step transition X_{i+1} | X_i is Normal(X_i*decay + mu*(1-decay), noise^2), the
   * same law _next() draws from. decay/noise are the one-step (dt) constants precomputed in
   * this.c — distinct from mean(t)/variance(t)'s elapsed-time decay exp(-theta*t) for
   * arbitrary t.
   *
   * @method _transitionLnPdf
   * @memberof ran.process.OrnsteinUhlenbeck
   * @param {number} xPrev State at the start of the step.
   * @param {number} xNext State at the end of the step.
   * @returns {number} Log-density of the transition xPrev -> xNext.
   * @protected
   * @ignore
   */
  _transitionLnPdf (xPrev, xNext) {
    const { mu } = this.p
    const { decay, noise, logNoise } = this.c
    const m = xPrev * decay + mu * (1 - decay)
    const z = (xNext - m) / noise
    return -0.5 * z * z - logNoise - 0.5 * Math.log(2 * Math.PI)
  }

  /** @inheritdoc */
  mean (t) {
    if (t < 0) return NaN
    const e = Math.exp(-this.p.theta * t)
    return this.x0 * e + this.p.mu * (1 - e)
  }

  /** @inheritdoc */
  variance (t) {
    if (t < 0) return NaN
    return this.p.sigma * this.p.sigma * (1 - Math.exp(-2 * this.p.theta * t)) / (2 * this.p.theta)
  }

  /** @inheritdoc */
  pdf (x, t) {
    if (t <= 0) return NaN
    const mu = this.mean(t)
    const sigma = Math.sqrt(this.variance(t))
    const z = (x - mu) / sigma
    return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI))
  }

  /** @inheritdoc */
  covariogram (s, t) {
    if (s < 0 || t < 0) return NaN
    const { theta, sigma } = this.p
    return (sigma * sigma / (2 * theta)) * (Math.exp(-theta * Math.abs(t - s)) - Math.exp(-theta * (t + s)))
  }

  /** @inheritdoc */
  marginal (t) {
    if (t <= 0) {
      throw Error('OrnsteinUhlenbeck.marginal(): t must be > 0')
    }
    return new Normal(this.mean(t), Math.sqrt(this.variance(t)))
  }

  /**
   * Estimates theta, mu, and sigma from an observed path via OLS regression of X_{n+1} on
   * X_n. Because _next() is already the exact AR(1) transition X_{n+1} = a + b*X_n + eps
   * (b = exp(-theta*dt), a = mu*(1-b)), this OLS regression coincides exactly with the MLE.
   *
   * @method fit
   * @memberof ran.process.OrnsteinUhlenbeck
   * @param {Array} path Array of observed states (as returned by path()).
   * @param {number} [dt=1] Time step between consecutive path observations (must be > 0).
   * @returns {OrnsteinUhlenbeck} A new instance with estimated theta, mu, and sigma.
   * @throws {Error} If path has fewer than 4 states, if dt is not > 0, or if the estimated
   * AR(1) slope falls outside (0,1) (too short or too noisy a path to recover mean reversion).
   * @ignore
   */
  static fit (path, dt = 1) {
    Process.validate({ dt }, ['dt > 0'])
    if (!Array.isArray(path) || path.length < 4) {
      throw Error('OrnsteinUhlenbeck.fit(): path must contain at least 4 states')
    }
    const n = path.length - 1
    const xs = path.slice(0, n)
    const ys = path.slice(1)
    const { slope: b, intercept: a } = ols(xs, ys)
    if (!(b > 0 && b < 1)) {
      throw Error('OrnsteinUhlenbeck.fit(): estimated AR(1) slope is out of (0,1); path is too short or too noisy to recover a mean-reverting parameter set')
    }
    let ss = 0
    for (let i = 0; i < n; i++) {
      const e = ys[i] - a - b * xs[i]
      ss += e * e
    }
    const s2 = ss / (n - 2)
    const theta = -Math.log(b) / dt
    const mu = a / (1 - b)
    const sigma = Math.sqrt(s2 * 2 * theta / (1 - b * b))
    return new OrnsteinUhlenbeck(theta, mu, sigma, dt)
  }
}
