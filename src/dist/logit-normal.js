import Normal from './normal'
import { erfinv } from '../special'

/**
 * Probability density function for the [logit-normal distribution]{@link https://en.wikipedia.org/wiki/Logit-normal_distribution}:
 *
 * $f(x; \mu, \sigma) = \frac{1}{\sigma \sqrt{2 \pi} x (1 - x)} e^{-\frac{\[\mathrm{logit}(x) - \mu\]^2}{2 \sigma^2}},$
 *
 * with $\mu \in \mathbb{R}$, $\sigma > 0$ and $\mathrm{logit}(x) = \ln \frac{x}{1 - x}$. Support: $x \in (0, 1)$.
 *
 * @class LogitNormal
 * @memberof ran.dist
 * @constructor
 */
export default class LogitNormal extends Normal {
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
      value: 1,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling by transforming normal variate
    return 1 / (1 + Math.exp(-super._generator()))
  }

  _pdf (x) {
    return super._pdf(Math.log(x / (1 - x))) / (x * (1 - x))
  }

  _cdf (x) {
    return super._cdf(Math.log(x / (1 - x)))
  }

  _q (p) {
    return 1 / (1 + Math.exp(-(this.p.mu + this.c.sigmaRoot2 * erfinv(2 * p - 1))))
  }

  /**
   * @returns {number} Mean of the distribution.
   */
  mean () {
    return this._numericalRawMoment(1)
  }

  /**
   * @returns {number} Variance of the distribution.
   */
  variance () {
    const m1 = this._numericalRawMoment(1)
    const m2 = this._numericalRawMoment(2)
    const v = m2 - m1 * m1
    return v < 0 ? 0 : v
  }

  /**
   * @returns {number} Skewness of the distribution.
   */
  skewness () {
    const m1 = this._numericalRawMoment(1)
    const m2 = this._numericalRawMoment(2)
    const m3 = this._numericalRawMoment(3)
    const v = m2 - m1 * m1
    if (!(v > 0)) return NaN
    return (m3 - 3 * m1 * m2 + 2 * Math.pow(m1, 3)) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} Excess kurtosis of the distribution.
   */
  kurtosis () {
    const m1 = this._numericalRawMoment(1)
    const m2 = this._numericalRawMoment(2)
    const m3 = this._numericalRawMoment(3)
    const m4 = this._numericalRawMoment(4)
    const v = m2 - m1 * m1
    if (!(v > 0)) return NaN
    return (m4 - 4 * m1 * m3 + 6 * m1 * m1 * m2 - 3 * Math.pow(m1, 4)) / (v * v) - 3
  }

  static get _fitInitIsExact () {
    // _fitInit returns the exact closed-form MLE, so fit() skips the optimizer (ADR-0016).
    return true
  }

  static _fitInit (data) {
    // logit(Y) ~ Normal(mu, sigma): MOM on logit scale gives the natural parameterization
    const n = data.length
    const logitData = data.map(x => Math.log(x / (1 - x)))
    const mu = logitData.reduce((s, x) => s + x, 0) / n
    const sigma = Math.sqrt(logitData.reduce((s, x) => s + (x - mu) ** 2, 0) / n) || 1
    return [mu, sigma]
  }
}
