import normal from '../dist/_normal'
import Process from './_process'

/**
 * First-order autoregressive (AR(1)) process, the discrete-time analogue of the
 * Ornstein-Uhlenbeck process.
 *
 * The update rule per step is
 *
 * $X_{n+1} = \phi X_n + \sigma Z,$
 *
 * where $Z \sim \mathcal{N}(0, 1)$. For $|\phi| < 1$ the process is stationary with
 * marginal distribution $\mathcal{N}(0, \sigma^2/(1-\phi^2))$. For $|\phi| \geq 1$
 * the process is non-stationary and grows without bound; a warning is emitted but no
 * error is thrown.
 *
 * @class AR1
 * @memberof ran.process
 * @constructor
 */
export default class AR1 extends Process {
  /**
   * @param {number} phi Autoregressive coefficient.
   * @param {number} sigma Innovation standard deviation (must be > 0).
   */
  constructor (phi, sigma) {
    super()
    Process.validate({ phi, sigma }, ['sigma > 0'])
    if (Math.abs(phi) >= 1) {
      console.warn('[ranjs] AR1: |phi| >= 1; the process is non-stationary.')
    }
    this.p = { phi, sigma }
    this.x = 0
    this.x0 = 0
  }

  _next () {
    return this.p.phi * this.x + this.p.sigma * normal(this.r)
  }

  /** @inheritdoc */
  mean (t) {
    if (t < 0) return NaN
    return 0
  }

  /** @inheritdoc */
  variance (t) {
    if (t < 0) return NaN
    const { phi, sigma } = this.p
    const phi2 = phi * phi
    // For |phi| = 1 the geometric-series formula has a 0/0 indeterminate form; the limit is sigma^2*t
    if (Math.abs(phi2 - 1) < 1e-14) {
      return sigma * sigma * t
    }
    return sigma * sigma * (1 - Math.pow(phi2, t)) / (1 - phi2)
  }

  /** @inheritdoc */
  pdf (x, t) {
    if (t <= 0) return NaN
    const v = this.variance(t)
    if (v <= 0) return NaN
    const s = Math.sqrt(v)
    const z = x / s
    return Math.exp(-0.5 * z * z) / (s * Math.sqrt(2 * Math.PI))
  }

  /** @inheritdoc */
  covariogram (s, t) {
    if (s < 0 || t < 0) return NaN
    const { phi, sigma } = this.p
    const phi2 = phi * phi
    const absLag = Math.abs(t - s)
    const minTime = Math.min(s, t)
    if (Math.abs(phi2 - 1) < 1e-14) {
      return Math.pow(phi, absLag) * sigma * sigma * minTime
    }
    return Math.pow(phi, absLag) * sigma * sigma * (1 - Math.pow(phi2, minTime)) / (1 - phi2)
  }
}
