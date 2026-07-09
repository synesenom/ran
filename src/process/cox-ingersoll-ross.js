import normal from '../dist/_normal'
import logGamma from '../special/log-gamma'
import Process from './_process'

/**
 * Cox-Ingersoll-Ross (CIR) mean-reverting process, using an Euler-Maruyama discretization
 * with reflection to keep paths non-negative.
 *
 * The underlying SDE is
 *
 * $\mathrm{d}X_t = \kappa(\theta - X_t) \mathrm{d}t + \sigma\sqrt{X_t} \mathrm{d}W_t.$
 *
 * The Euler-Maruyama step uses reflection to prevent the noise term from amplifying
 * negative states:
 *
 * $X_{n+1} = X_n + \kappa(\theta - X_n)\Delta t + \sigma\sqrt{\max(X_n, 0)} \sqrt{\Delta t} Z,$
 *
 * where $Z \sim \mathcal{N}(0, 1)$. When the Feller condition $2\kappa\theta > \sigma^2$ holds, the continuous-time process
 * is strictly positive; below the Feller threshold, paths may occasionally become negative
 * under Euler-Maruyama despite the reflection.
 *
 * @class CoxIngersollRoss
 * @memberof ran.process
 * @constructor
 */
export default class CoxIngersollRoss extends Process {
  /**
   * @param {number} kappa Mean-reversion speed (must be > 0).
   * @param {number} theta Long-run mean (must be > 0).
   * @param {number} sigma Volatility (must be > 0).
   * @param {number} [dt=1] Time step (must be > 0).
   */
  constructor (kappa, theta, sigma, dt = 1) {
    super()
    Process.validate({ kappa, theta, sigma, dt }, ['kappa > 0', 'theta > 0', 'sigma > 0', 'dt > 0'])
    // Warn but do not throw: below the Feller threshold the Euler-Maruyama scheme
    // may produce negative states even with the max(·,0) reflection.
    if (2 * kappa * theta <= sigma * sigma) {
      console.warn('[ranjs] CoxIngersollRoss: Feller condition (2κθ > σ²) is not met; paths may become negative.')
    }
    this.p = { kappa, theta, sigma, dt }
    this.x = 0
    this.x0 = 0
    this.c = {
      kappaDt: kappa * dt,
      sigmaSqrtDt: sigma * Math.sqrt(dt),
      sigma2OverKappa: sigma * sigma / kappa
    }
  }

  _next () {
    const { theta } = this.p
    const { kappaDt, sigmaSqrtDt } = this.c
    return this.x + kappaDt * (theta - this.x) + sigmaSqrtDt * Math.sqrt(Math.max(this.x, 0)) * normal(this.r)
  }

  /** @inheritdoc */
  mean (t) {
    if (t < 0) return NaN
    const e = Math.exp(-this.p.kappa * t)
    return this.x0 * e + this.p.theta * (1 - e)
  }

  /** @inheritdoc */
  variance (t) {
    if (t < 0) return NaN
    const { kappa, theta } = this.p
    const { sigma2OverKappa } = this.c
    const e = Math.exp(-kappa * t)
    return this.x0 * sigma2OverKappa * (e - e * e) + theta * sigma2OverKappa / 2 * (1 - e) * (1 - e)
  }

  /** @inheritdoc */
  pdf (x, t) {
    if (t <= 0) return NaN
    if (x < 0) return 0
    const { kappa, theta } = this.p
    const { sigma2OverKappa } = this.c
    const alpha = 2 * theta / sigma2OverKappa
    const scale = sigma2OverKappa / 2 * (1 - Math.exp(-kappa * t))
    if (x === 0) {
      if (alpha < 1) return Infinity
      if (alpha > 1) return 0
      return 1 / scale
    }
    return Math.exp((alpha - 1) * Math.log(x) - x / scale - logGamma(alpha) - alpha * Math.log(scale))
  }

  /** @inheritdoc */
  covariogram (s, t) {
    if (s < 0 || t < 0) return NaN
    const { kappa, theta } = this.p
    const { sigma2OverKappa } = this.c
    const em = Math.exp(-kappa * Math.min(s, t))
    return theta * sigma2OverKappa / 2 * (1 - em) * (1 - em) * Math.exp(-kappa * Math.abs(t - s))
  }
}
