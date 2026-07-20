import { gammaLowerIncompleteInv } from '../special'
import Gamma from './gamma'
import Distribution from './_distribution'

/**
 * Probability density function for the [log-gamma distribution]{@link https://reference.wolfram.com/language/ref/LogGammaDistribution.html} using the
 * shape/rate parametrization:
 *
 * $f(x; \alpha, \beta, \mu) = \frac{\beta^\alpha}{\Gamma(\alpha)} \ln^{\alpha - 1}(x - \mu + 1) (x - \mu + 1)^{-(1 + \beta)},$
 *
 * where $\alpha, \beta > 0$ and $\mu \ge 0$. Support: $x \in [\mu, \infty)$.
 *
 * @class LogGamma
 * @memberof ran.dist
 * @constructor
 */
export default class LogGamma extends Gamma {
  /**
   * @param {number} alpha Shape parameter.
   * @param {number} beta Rate parameter.
   * @param {number} mu Location parameter.
   */
  constructor (alpha, beta, mu) {
    super(alpha, beta)
    // LogGamma has 3 free parameters (alpha, beta, mu); override the 2 inherited from Gamma
    this.k = 3

    // Validate parameters
    this.p = Object.assign(this.p, { mu })
    Distribution.validate({ mu }, [
      'mu >= 0'
    ])

    // Set support
    this.s = [{
      value: mu,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants: r1..r4 are shared verbatim by mean/variance/skewness/kurtosis.
    // Merged: Gamma's constructor already set this.c.logNorm, which super._pdf still relies on.
    Object.assign(this.c, {
      r1: this._expMoment(1, alpha, beta),
      r2: this._expMoment(2, alpha, beta),
      r3: this._expMoment(3, alpha, beta),
      r4: this._expMoment(4, alpha, beta)
    })
  }

  _q (p) {
    // LogGamma: X = exp(Y) + mu - 1 where Y ~ Gamma(alpha, beta); invert via exp
    return Math.exp(gammaLowerIncompleteInv(this.p.alpha, p) / this.p.beta) + this.p.mu - 1
  }

  _generator () {
    // Direct sampling by transforming gamma variate
    return Math.exp(super._generator()) + this.p.mu - 1
  }

  _pdf (x) {
    return super._pdf(Math.log(x - this.p.mu + 1)) / (x - this.p.mu + 1)
  }

  _cdf (x) {
    return super._cdf(Math.log(x - this.p.mu + 1))
  }

  // Moments of X = e^Y + μ − 1 with Y ~ Gamma(α, rate β) come from the gamma MGF
  // E[e^{kY}] = (β/(β−k))^α, NOT from digamma/polygamma (those describe ln of a gamma
  // variate, the opposite transform). The k-th raw moment diverges once β ≤ k.
  _expMoment (k, alpha, beta) {
    return beta > k ? Math.pow(beta / (beta - k), alpha) : Infinity
  }

  /**
   * @returns {number} The mean, $(\beta/(\beta-1))^\alpha + \mu - 1$; `Infinity` for $\beta \le 1$.
   */
  mean () {
    return this.c.r1 + this.p.mu - 1
  }

  /**
   * @returns {number} The variance; `Infinity` for $\beta \le 2$.
   */
  variance () {
    if (!Number.isFinite(this.c.r2)) return Infinity
    const { r1, r2 } = this.c
    return r2 - r1 * r1
  }

  /**
   * @returns {number} The skewness; `Infinity` for $\beta \le 3$.
   */
  skewness () {
    if (!Number.isFinite(this.c.r3)) return Infinity
    const { r1, r2, r3 } = this.c
    const v = r2 - r1 * r1
    return (r3 - 3 * r1 * r2 + 2 * r1 ** 3) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis; `Infinity` for $\beta \le 4$.
   */
  kurtosis () {
    if (!Number.isFinite(this.c.r4)) return Infinity
    const { r1, r2, r3, r4 } = this.c
    const v = r2 - r1 * r1
    return (r4 - 4 * r1 * r3 + 6 * r1 * r1 * r2 - 3 * r1 ** 4) / (v * v) - 3
  }

  static _fitInit (data) {
    // log(x−μ+1) ~ Gamma(α,β) with μ=0: gamma MOM on log(x+1) seeds the Gamma parameters
    const n = data.length
    const transformed = data.map(x => Math.log(x + 1))
    const mean = transformed.reduce((s, x) => s + x, 0) / n
    const variance = transformed.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1
    return [mean ** 2 / variance, mean / variance, 0]
  }
}
