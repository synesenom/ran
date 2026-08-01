import normal from '../dist/_normal'
import Normal from '../dist/normal'
import Process from './_process'
import ols from './_ols'

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
    // X_0 = 0 deterministically, independent of phi/sigma; short-circuiting here also avoids
    // 0 * Math.log(phi2) producing NaN when phi2 underflows to 0 or overflows to Infinity
    if (t === 0) return 0
    const { phi, sigma } = this.p
    const phi2 = phi * phi
    // For |phi| = 1 the geometric-series formula has a 0/0 indeterminate form; the limit is sigma^2*t
    if (Math.abs(phi2 - 1) < 1e-14) {
      return sigma * sigma * t
    }
    // -expm1(t*log(phi2)) avoids catastrophic cancellation in 1-phi2^t when
    // phi2 is close to 1 and t is small, where Math.pow(phi2, t) rounds to 1
    return sigma * sigma * (-Math.expm1(t * Math.log(phi2))) / (1 - phi2)
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

  /** @inheritdoc */
  marginal (t) {
    if (t <= 0) {
      throw Error('AR1.marginal(): t must be > 0')
    }
    const v = this.variance(t)
    if (v <= 0) {
      throw Error('AR1.marginal(): variance is not positive at t')
    }
    return new Normal(0, Math.sqrt(v))
  }

  /**
   * Estimates phi and sigma from an observed path via OLS regression of X_{n+1} on X_n, reusing
   * the same ols() helper as OrnsteinUhlenbeck.fit(). The true transition has no intercept
   * (_next() is phi*X_n + sigma*Z), but fitting through the shared intercept-plus-slope form
   * still recovers phi consistently since the true intercept is exactly 0; only the slope is
   * kept and the intercept is otherwise discarded, apart from computing residuals for sigma.
   *
   * @method fit
   * @memberof ran.process.AR1
   * @param {Array} path Array of observed states (as returned by path()).
   * @returns {AR1} A new instance with estimated phi and sigma.
   * @throws {Error} If path has fewer than 4 states.
   */
  static fit (path) {
    if (!Array.isArray(path) || path.length < 4) {
      throw Error('AR1.fit(): path must contain at least 4 states')
    }
    const n = path.length - 1
    const xs = path.slice(0, n)
    const ys = path.slice(1)
    const { slope: phi, intercept: a } = ols(xs, ys)
    let ss = 0
    for (let i = 0; i < n; i++) {
      const e = ys[i] - a - phi * xs[i]
      ss += e * e
    }
    const sigma2 = ss / (n - 2)
    return new AR1(phi, Math.sqrt(sigma2))
  }
}
