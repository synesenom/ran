import normal from '../dist/_normal'
import logGamma from '../special/log-gamma'
import Gamma from '../dist/gamma'
import Process from './_process'
import ols from './_ols'

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
 * $X_{t+\mathrm{d}t} = X_t + \kappa(\theta - X_t)\,\mathrm{d}t + \sigma\sqrt{\max(X_t, 0)}\,\sqrt{\mathrm{d}t}\,Z,$
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
      // The transition density is a Gamma(alpha, 1/scale) (see marginal()), whose own support is
      // open at 0 whenever alpha < 1 — matching the Gamma/Beta/Weibull convention used throughout
      // ran.dist where a divergent boundary point is excluded from the support and pdf() returns
      // 0 there. Mirror that here so pdf(0, t) stays consistent with marginal(t).pdf(0).
      if (alpha === 1) return 1 / scale
      return 0
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

  /** @inheritdoc */
  marginal (t) {
    if (t <= 0) {
      throw Error('CoxIngersollRoss.marginal(): t must be > 0')
    }
    // Starting from x0 = 0, the CIR transition density's noncentrality vanishes and the
    // noncentral chi-squared collapses to a plain Gamma — the same shape/scale used by pdf().
    const { kappa, theta } = this.p
    const { sigma2OverKappa } = this.c
    const alpha = 2 * theta / sigma2OverKappa
    const scale = sigma2OverKappa / 2 * (1 - Math.exp(-kappa * t))
    return new Gamma(alpha, 1 / scale)
  }

  /**
   * Estimates kappa, theta, and sigma from an observed path via Conditional Least Squares
   * (Overbeck & Ryden, 1997). The true one-step conditional transition of CIR is a scaled
   * noncentral chi-squared with generally non-integer degrees of freedom — this codebase has
   * no machinery to represent that exactly (ran.dist.NoncentralChi2 rounds its k to the
   * nearest integer), so this estimator instead matches the first two conditional moments,
   * both of which are affine in the previous observation: stage 1 regresses X_{n+1} on X_n
   * (identical algebra to OrnsteinUhlenbeck.fit()) for kappa and theta; stage 2 regresses the
   * squared stage-1 residuals on X_n for sigma. This is consistent but not maximally
   * efficient (unlike BrownianMotion/GeometricBrownianMotion/OrnsteinUhlenbeck's exact MLE),
   * and its accuracy degrades near the Feller boundary and at large dt, where _next()'s own
   * Euler-Maruyama discretization diverges further from the exact continuous-time conditional
   * moments this estimator targets. See decisions/0044-process-fit-static-factory.md.
   *
   * @method fit
   * @memberof ran.process.CoxIngersollRoss
   * @param {Array} path Array of observed states (as returned by path()).
   * @param {number} [dt=1] Time step between consecutive path observations (must be > 0).
   * @returns {CoxIngersollRoss} A new instance with estimated kappa, theta, and sigma.
   * @throws {Error} If path has fewer than 4 states, if dt is not > 0, if the estimated
   * AR(1) slope falls outside (0,1), or if the estimated sigma^2 is not positive.
   */
  static fit (path, dt = 1) {
    Process.validate({ dt }, ['dt > 0'])
    if (!Array.isArray(path) || path.length < 4) {
      throw Error('CoxIngersollRoss.fit(): path must contain at least 4 states')
    }
    const n = path.length - 1
    const xs = path.slice(0, n)
    const ys = path.slice(1)
    const { slope: b, intercept: a } = ols(xs, ys)
    if (!(b > 0 && b < 1)) {
      throw Error('CoxIngersollRoss.fit(): estimated AR(1) slope is out of (0,1); path is too short or too noisy to recover a mean-reverting parameter set')
    }
    const kappa = -Math.log(b) / dt
    const theta = a / (1 - b)
    if (!(theta > 0)) {
      throw Error('CoxIngersollRoss.fit(): estimated theta is not positive; path is too short or too noisy for this estimator')
    }

    // Stage 2: regress squared stage-1 residuals on X_n (Var[X_{n+1}|X_n] is affine in X_n).
    const e2 = xs.map((xi, i) => {
      const e = ys[i] - a - b * xi
      return e * e
    })
    const { slope: alpha } = ols(xs, e2)
    const sigma2 = alpha * kappa / (b - b * b)
    if (!(sigma2 > 0)) {
      throw Error('CoxIngersollRoss.fit(): estimated sigma^2 is non-positive; path is too short or noise-dominated for this estimator')
    }
    return new CoxIngersollRoss(kappa, theta, Math.sqrt(sigma2), dt)
  }
}
