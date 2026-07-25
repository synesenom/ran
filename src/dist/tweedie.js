import { logGamma, gammaLowerIncomplete } from '../special'
import { EPS, MAX_SERIES_ITER } from '../core/constants'
import poisson from './_poisson'
import gamma from './_gamma'
import clamp from '../utils/clamp'
import Distribution from './_distribution'

// Builds the Dunn & Smyth (2005) log-space series term j -> log(W_j) for the compound
// Poisson-Gamma EDM density, closing over the (y, phi, p, alpha) shared by every term so each
// call only varies j: W_j = y^(-j*alpha) * (p-1)^(alpha*j) / (phi^(j*(1-alpha)) * (2-p)^j * j! *
// Gamma(-j*alpha)). All terms are positive for 1<p<2 (alpha<0), unlike the alternating-sign p>2
// series, so a plain log-sum-exp accumulation reaches machine accuracy without cancellation.
function makeLogWj (y, phi, p, alpha) {
  const logY = Math.log(y)
  const logPm1 = Math.log(p - 1)
  const logPhi = Math.log(phi)
  const log2mp = Math.log(2 - p)
  return j => (-j * alpha) * logY + (alpha * j) * logPm1 -
    (j * (1 - alpha)) * logPhi - j * log2mp -
    logGamma(j + 1) - logGamma(-j * alpha)
}

// Sums the W_j series in log-space, subtracting the Stirling-estimated peak term (Dunn & Smyth
// 2005, §4) before exponentiating so every term stays within double range regardless of how
// large or small the unnormalized sum is.
function logDensitySeries (y, phi, p, alpha) {
  const logWj = makeLogWj(y, phi, p, alpha)
  const jPeak = Math.max(1, Math.round(Math.pow(y, 2 - p) / ((2 - p) * phi)))
  const logMax = logWj(jPeak)
  let sum = 0
  // MAX_SERIES_ITER alone is not always enough: jPeak itself grows past 500 for large y, small
  // phi, or p close to 2, in which case the loop would exit before ever reaching the series'
  // dominant terms (matching the dynamic cap pattern in special/gamma-incomplete.js's _gli).
  // See solutions/correctness/2026-07-25-1257-tweedie-series-peak-exceeds-fixed-iter-cap.md
  const iterCap = Math.max(MAX_SERIES_ITER, jPeak + 50)
  for (let j = 1; j < iterCap; j++) {
    const term = Math.exp(logWj(j) - logMax)
    sum += term
    if (j > jPeak + 10 && term < sum * EPS) {
      break
    }
  }
  return logMax + Math.log(sum)
}

/**
 * Generator for the [Tweedie distribution]{@link https://en.wikipedia.org/wiki/Tweedie_distribution} for the
 * power parameter range $1 < p < 2$, using the mean/dispersion/power parametrization:
 *
 * $f(y; \mu, \phi, p) = P(Y = 0) \delta(y) + a(y, \phi, p) \exp\Big[\frac{1}{\phi}\big(y \theta - \kappa(\theta)\big)\Big] \mathbb{1}_{y > 0},$
 *
 * where $\theta = \mu^{1 - p} / (1 - p)$, $\kappa(\theta) = \mu^{2 - p} / (2 - p)$ and $a(y, \phi, p)$ is the
 * Dunn & Smyth (2005) series (Wright's generalized Bessel function). This is the exponential dispersion model
 * with variance function $V(\mu) = \mu^p$, equivalently the compound Poisson-Gamma mixture $Y = \sum_{i=1}^N X_i$
 * with $N \sim \mathrm{Poisson}(\lambda)$, $\lambda = \mu^{2 - p} / (\phi (2 - p))$, and $X_i$ i.i.d.
 * $\mathrm{Gamma}(\mathrm{shape} = (2 - p) / (p - 1), \mathrm{scale} = \phi (p - 1) \mu^{p - 1})$, so
 * $P(Y = 0) = \exp(-\lambda)$. Support: $y \geq 0$, with $\mu, \phi > 0$ and $1 < p < 2$.
 *
 * @class Tweedie
 * @memberof ran.dist
 * @constructor
 */
export default class Tweedie extends Distribution {
  /**
   * @param {number} mu Mean of the distribution.
   * @param {number} phi Dispersion parameter.
   * @param {number} p Power parameter, determining the variance function $V(\mu) = \mu^p$.
   */
  constructor (mu, phi, p) {
    super('continuous', 3)

    // Validate parameters
    this.p = { mu, phi, p }
    Distribution.validate({ mu, phi, p }, [
      'mu > 0',
      'phi > 0',
      'p > 1',
      'p < 2'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    const alpha = (2 - p) / (1 - p)
    const lambda = Math.pow(mu, 2 - p) / (phi * (2 - p))
    this.c = {
      alpha,
      lambda,
      logLambda: Math.log(lambda),
      gammaShape: (2 - p) / (p - 1),
      gammaRate: 1 / (phi * (p - 1) * Math.pow(mu, p - 1)),
      theta: Math.pow(mu, 1 - p) / (1 - p),
      kappa: Math.pow(mu, 2 - p) / (2 - p)
    }
  }

  /**
   * @returns {number} The mean parameter mu.
   */
  mean () {
    return this.p.mu
  }

  /**
   * @returns {number} Dispersion times mean to the power of p.
   */
  variance () {
    return this.p.phi * Math.pow(this.p.mu, this.p.p)
  }

  /**
   * @returns {number} Power times square root of dispersion times mean to the power of (p - 2) / 2.
   */
  skewness () {
    return this.p.p * Math.sqrt(this.p.phi) * Math.pow(this.p.mu, (this.p.p - 2) / 2)
  }

  /**
   * @returns {number} Power times (2 * power - 1) times dispersion times mean to the power of (p - 2).
   */
  kurtosis () {
    return this.p.p * (2 * this.p.p - 1) * this.p.phi * Math.pow(this.p.mu, this.p.p - 2)
  }

  _generator () {
    // Exact compound Poisson-Gamma simulation (not an approximation): sampling this way makes
    // sample() correct by construction from the distribution's own generative definition, with
    // no dependence on the _pdf/_cdf series machinery below.
    const n = poisson(this.r, this.c.lambda)
    if (n === 0) {
      return 0
    }
    let sum = 0
    for (let i = 0; i < n; i++) {
      sum += gamma(this.r, this.c.gammaShape, this.c.gammaRate)
    }
    return sum
  }

  _pdf (x) {
    if (x === 0) {
      return Math.exp(-this.c.lambda)
    }
    const logW = logDensitySeries(x, this.p.phi, this.p.p, this.c.alpha)
    return Math.exp(logW - Math.log(x) + (x * this.c.theta - this.c.kappa) / this.p.phi)
  }

  _cdf (x) {
    if (x === 0) {
      return Math.exp(-this.c.lambda)
    }
    const { lambda, gammaShape, gammaRate } = this.c
    // j=0 term: Gamma(shape=0) is a point mass at 0, so its contribution to F(x) for x>0 is
    // exactly the Poisson(N=0) weight -- gammaLowerIncomplete(0, ...) is not the point-mass CDF.
    let sum = Math.exp(-lambda)
    let logPoissonTerm = -lambda
    // See logDensitySeries: MAX_SERIES_ITER alone is not always enough when the Poisson weight
    // peaks (near j=lambda) past 500 terms in.
    const iterCap = Math.max(MAX_SERIES_ITER, Math.ceil(lambda) + 50)
    for (let j = 1; j < iterCap; j++) {
      logPoissonTerm += this.c.logLambda - Math.log(j)
      const term = Math.exp(logPoissonTerm) * gammaLowerIncomplete(j * gammaShape, gammaRate * x)
      sum += term
      // Purely relative floor (no Math.max(sum, 1) absolute floor): F(x) can be legitimately
      // far below 1 (small x, large lambda), and an absolute floor would falsely declare
      // convergence early in that regime (see solutions/correctness/2026-07-23-1108-*.md).
      if (j > lambda + 10 && term < sum * EPS) {
        break
      }
    }
    // Summing many small positive floating-point terms can overshoot 1 by a few ULPs.
    return clamp(sum)
  }

  _q (p) {
    // cdf(x) - p >= 0 for every x >= 0 whenever p is at or below the point mass P(Y=0), so the
    // base class's root-finder never finds a sign change and returns NaN; the correct quantile
    // there is the support's lower boundary itself.
    // See solutions/correctness/2026-07-25-1257-tweedie-point-mass-quantile-nan.md
    if (p <= Math.exp(-this.c.lambda)) {
      return 0
    }
    return this._qEstimateRoot(p)
  }

  static _fitInit (data) {
    // No closed-form estimator exists for p from an unstructured sample; seed it at the
    // literature-typical midpoint and let Powell refine it, following the same fixed-guess
    // pattern NoncentralBeta uses for its own hard-to-estimate noncentrality parameter.
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1
    const p = 1.5
    return [Math.max(mean, 1e-8), Math.max(variance / Math.pow(Math.max(mean, 1e-8), p), 1e-8), p]
  }
}
