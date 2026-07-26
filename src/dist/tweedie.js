import { logGamma, gammaLowerIncomplete } from '../special'
import { EPS, MAX_SERIES_ITER } from '../core/constants'
import poisson from './_poisson'
import gamma from './_gamma'
import clamp from '../utils/clamp'
import Distribution from './_distribution'

// Number of peak standard deviations the _pdf and _cdf series must be allowed to run past their
// mode before the iteration cap may cut them off. Both sums are unimodal in j with a Gaussian-like
// peak whose WIDTH grows as sqrt(peak) -- the density's W_j series has curvature
// d²/dj² log(W_j) = -1/(j (p-1)) at its mode, and the CDF's Poisson(lambda) weights have standard
// deviation sqrt(lambda). A cap allowing only a CONSTANT number of terms past the peak therefore
// covers fewer and fewer standard deviations as the peak moves out, and silently truncates the sum
// mid-peak. The relative convergence test itself only turns on around 8 sigma (where a term first
// drops below EPS times the accumulated sum), so anything below that is guaranteed truncation:
// at Tweedie(50, 0.02, 1.5) a fixed 50-term slack reached 1.9 sigma, leaving pdf(50) 0.5% low,
// cdf(100) at 0.970 instead of 1, and q(p) NaN for every p above 0.97. Twelve sigma clears the
// convergence test's turn-on point with ~4 sigma to spare, discarding a tail of order exp(-72).
// See solutions/correctness/2026-07-25-1257-tweedie-series-peak-exceeds-fixed-iter-cap.md
const PEAK_SIGMAS = 12

// Iteration cap for a series whose terms peak at index `peak`: enough room to walk from j = 1 all
// the way through the peak and PEAK_SIGMAS beyond it, never below the shared MAX_SERIES_ITER floor.
function seriesIterCap (peak) {
  return peak + Math.max(MAX_SERIES_ITER, Math.ceil(PEAK_SIGMAS * Math.sqrt(peak)))
}

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
  // MAX_SERIES_ITER alone is not enough: jPeak itself grows past 500 for large y, small phi, or p
  // close to 2, in which case the loop would exit before ever reaching the series' dominant terms
  // (matching the dynamic cap pattern in special/gamma-incomplete.js's _gli).
  const iterCap = seriesIterCap(jPeak)
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
 * Probability density function for the [Tweedie distribution]{@link https://en.wikipedia.org/wiki/Tweedie_distribution},
 * restricted to the compound Poisson-gamma power range $1 < p < 2$. It is the exponential dispersion model whose
 * variance function is $V(\mu) = \mu^p$, parametrized here by its mean $\mu$, its dispersion $\phi$ and the power $p$,
 * so that $\mathrm{E}(Y) = \mu$ and $\mathrm{Var}(Y) = \phi \mu^p$. (The dispersion is written $\sigma^2$ on the linked
 * page and $\phi$ in the GLM literature this implementation follows; they are the same parameter.)
 *
 * Over this power range the distribution is a mixture of an atom at the origin and a continuous density above it,
 *
 * $\mathrm{P}(Y = 0) = e^{-\lambda}, \qquad f(y; \mu, \phi, p) = \frac{W(y; \phi, p)}{y} \exp\Big[\frac{y \theta - \kappa(\theta)}{\phi}\Big] \quad \text{for } y > 0,$
 *
 * with $\lambda = \frac{\mu^{2 - p}}{\phi (2 - p)}$, natural parameter $\theta = \frac{\mu^{1 - p}}{1 - p}$ and cumulant
 * function $\kappa(\theta) = \frac{\mu^{2 - p}}{2 - p}$. The normalizing factor $W$ has no closed form; it is the
 * [Dunn & Smyth (2005)]{@link https://doi.org/10.1007/s11222-005-4070-y} series representation of Wright's generalized
 * Bessel function,
 *
 * $W(y; \phi, p) = \sum\_{j = 1}^\infty \frac{y^{-j \alpha} (p - 1)^{j \alpha}}{\phi^{j (1 - \alpha)} (2 - p)^j\, j!\, \Gamma(-j \alpha)}, \qquad \alpha = \frac{2 - p}{1 - p} < 0.$
 *
 * Equivalently $Y$ is a compound Poisson-gamma total $Y = \sum\_{i = 1}^N X_i$, where $N \sim \mathrm{Poisson}(\lambda)$
 * counts the contributing events and the $X_i$ are i.i.d. gamma variates of shape $\frac{2 - p}{p - 1}$ and scale
 * $\phi (p - 1) \mu^{p - 1}$; the atom is simply the $N = 0$ outcome. Support: $y \in [0, \infty)$, with
 * $\mu, \phi > 0$ and $1 < p < 2$.
 *
 * Because the distribution is mixed rather than purely continuous, `pdf(0)` returns the atom's probability
 * $\mathrm{P}(Y = 0)$ rather than a density, and therefore agrees with `cdf(0)`.
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
   * @returns {number} The mean of the distribution, $\mu$.
   */
  mean () {
    return this.p.mu
  }

  /**
   * @returns {number} The variance of the distribution, $\phi \mu^p$.
   */
  variance () {
    return this.p.phi * Math.pow(this.p.mu, this.p.p)
  }

  /**
   * @returns {number} The skewness of the distribution, $p \sqrt{\phi}\, \mu^{(p - 2) / 2}$.
   */
  skewness () {
    return this.p.p * Math.sqrt(this.p.phi) * Math.pow(this.p.mu, (this.p.p - 2) / 2)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution, $p (2 p - 1) \phi \mu^{p - 2}$.
   */
  kurtosis () {
    return this.p.p * (2 * this.p.p - 1) * this.p.phi * Math.pow(this.p.mu, this.p.p - 2)
  }

  _generator () {
    // Exact compound Poisson-Gamma simulation (not an approximation): sampling this way makes
    // sample() correct by construction from the distribution's own generative definition, with
    // no dependence on the _pdf/_cdf series machinery below. The N events' total is drawn as a
    // single Gamma(N * shape, rate) rather than as a sum of N separate Gamma(shape, rate) draws,
    // which is again an identity rather than an approximation -- gamma variates sharing a rate are
    // additive in the shape -- and keeps a sample at O(1) instead of O(lambda), where lambda runs
    // into the thousands for the small-phi regimes this distribution is routinely fitted on.
    const n = poisson(this.r, this.c.lambda)
    return n === 0 ? 0 : gamma(this.r, n * this.c.gammaShape, this.c.gammaRate)
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
    // See logDensitySeries: MAX_SERIES_ITER alone is not enough when the Poisson weight peaks
    // (near j=lambda) past 500 terms in.
    const iterCap = seriesIterCap(Math.ceil(lambda))
    for (let j = 1; j < iterCap; j++) {
      // Each weight is evaluated outright rather than carried by the cheaper recurrence
      // log(w_j) = log(w_{j-1}) + log(lambda) - log(j), whose per-step rounding error is a drift
      // correlated across j that thousands of terms then accumulate coherently. Measured against
      // mpmath the closed form wins at every lambda tried (7.4e-14 vs 3.1e-13 at lambda = 707,
      // 4.2e-13 vs 1.1e-12 at 1585), for one logGamma on top of a gammaLowerIncomplete the term
      // already pays for.
      const logPoissonTerm = -lambda + j * this.c.logLambda - logGamma(j + 1)
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
