import Normal from './normal'
import { erfinv } from '../special'

/**
 * Probability density function for the [log-normal distribution]{@link https://en.wikipedia.org/wiki/Log-normal_distribution}:
 *
 * $f(x; \mu, \sigma) = \frac{1}{x \sigma \sqrt{2 \pi}}e^{-\frac{(\ln x - \mu)^2}{2\sigma^2}},$
 *
 * where $\mu \in \mathbb{R}$ and $\sigma > 0$. Support: $x > 0$.
 *
 * Cumulative distribution function:
 *
 * $F(x; \mu, \sigma) = \Phi\left(\frac{\ln x - \mu}{\sigma}\right)$
 *
 * where $\Phi$ is the standard normal CDF.
 *
 * @class LogNormal
 * @memberof ran.dist
 * @constructor
 */
export default class LogNormal extends Normal {
  // Transforming normal distribution
  /**
   * @param {number} mu Location parameter.
   * @param {number} sigma Scale parameter.
   */
  constructor (mu, sigma) {
    super(mu, sigma)

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling by transforming normal variate
    return Math.exp(super._generator())
  }

  _pdf (x) {
    return super._pdf(Math.log(x)) / x
  }

  _cdf (x) {
    return super._cdf(Math.log(x))
  }

  // Inlined Normal._q to avoid V8 megamorphic deoptimization — see solutions/performance/2026-05-23-1810-super-q-v8-megamorphic-deoptimization.md
  _q (p) {
    return Math.exp(this.p.mu + this.c.sigmaRoot2 * erfinv(2 * p - 1))
  }

  // Closed-form moments override the inherited Normal moments (which describe the underlying
  // log scale, not the exponentiated variate). All four are finite for every (μ, σ).
  /**
   * @returns {number} The mean, $e^{\mu + \sigma^2/2}$.
   */
  mean () {
    return Math.exp(this.p.mu + this.p.sigma * this.p.sigma / 2)
  }

  /**
   * @returns {number} The variance, $(e^{\sigma^2} - 1)\,e^{2\mu + \sigma^2}$.
   */
  variance () {
    const s2 = this.p.sigma * this.p.sigma
    // expm1 keeps full precision of e^{σ²} − 1 for small σ, where e^{σ²} rounds to exactly 1.
    return Math.expm1(s2) * Math.exp(2 * this.p.mu + s2)
  }

  /**
   * @returns {number} The skewness, $(e^{\sigma^2} + 2)\sqrt{e^{\sigma^2} - 1}$.
   */
  skewness () {
    const em1 = Math.expm1(this.p.sigma * this.p.sigma)
    return (em1 + 3) * Math.sqrt(em1)
  }

  /**
   * @returns {number} The excess kurtosis, $e^{4\sigma^2} + 2e^{3\sigma^2} + 3e^{2\sigma^2} - 6$.
   */
  kurtosis () {
    const s2 = this.p.sigma * this.p.sigma
    // The constants sum to 1+2+3−6=0, so an expm1 form cancels the −6 exactly and stays
    // accurate as σ→0 (where the excess kurtosis vanishes) instead of differencing near 6.
    return Math.expm1(4 * s2) + 2 * Math.expm1(3 * s2) + 3 * Math.expm1(2 * s2)
  }

  static get _fitInitIsExact () {
    // _fitInit returns the exact closed-form MLE, so fit() skips the optimizer (ADR-0016).
    return true
  }

  static _fitInit (data) {
    // log(Y) ~ Normal(mu, sigma): MOM on log scale gives the natural parameterization
    const n = data.length
    const logData = data.map(x => Math.log(x))
    const mu = logData.reduce((s, x) => s + x, 0) / n
    const sigma = Math.sqrt(logData.reduce((s, x) => s + (x - mu) ** 2, 0) / n) || 1
    return [mu, sigma]
  }
}
