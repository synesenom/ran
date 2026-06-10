import { gammaLowerIncompleteInv, logGamma } from '../special'
import GeneralizedGamma from './generalized-gamma'
import Distribution from './_distribution'

/**
 * Probability density function for the [generalized normal distribution]{@link https://en.wikipedia.org/wiki/Generalized_normal_distribution}:
 *
 * $f(x; \mu, \alpha, \beta) = \frac{\beta}{2 \alpha \Gamma\big(\frac{1}{\beta}\big)} e^{-\big(\frac{|x - \mu|}{\alpha}\big)^\beta},$
 *
 * where $\mu \in \mathbb{R}$ and $\alpha, \beta > 0$. Support: $x \in \mathbb{R}$. It is also a special case of the
 * [generalized gamma distribution]{@link #dist.GeneralizedGamma}.
 *
 * @class GeneralizedNormal
 * @memberof ran.dist
 * @constructor
 */
export default class GeneralizedNormal extends GeneralizedGamma {
  /**
   * @param {number} mu Location paramameter.
   * @param {number} alpha Scale parameter.
   * @param {number} beta Shape parameter.
   */
  constructor (mu, alpha, beta) {
    super(alpha, 1, beta)

    // Validate parameters
    this.p = Object.assign(this.p, { mu, alpha2: alpha, beta2: beta })
    Distribution.validate({ mu, alpha, beta }, [
      'alpha > 0',
      'beta > 0'
    ])

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _q (p) {
    // GeneralizedNormal folds GeneralizedGamma over mu; invert the fold then shift by mu
    const gg = Math.pow(gammaLowerIncompleteInv(this.p.alpha, p > 0.5 ? 2 * p - 1 : 1 - 2 * p) / this.p.beta, 1 / this.p.p)
    return p > 0.5 ? this.p.mu + gg : this.p.mu - gg
  }

  _generator () {
    // Transforming generalized gamma variate
    return (this.r.next() > 0.5 ? 1 : -1) * Math.abs(super._generator()) + this.p.mu
  }

  _pdf (x) {
    return super._pdf(Math.abs(x - this.p.mu)) / 2
  }

  _cdf (x) {
    return 0.5 * (1 + Math.sign(x - this.p.mu) * super._cdf(Math.abs(x - this.p.mu)))
  }

  /**
   * @returns {number} Location parameter.
   */
  mean () {
    return this.p.mu
  }

  /**
   * @returns {number} Variance of the distribution.
   */
  variance () {
    return this.p.alpha2 ** 2 * Math.exp(logGamma(3 / this.p.beta2) - logGamma(1 / this.p.beta2))
  }

  /**
   * @returns {number} Zero (the generalized normal distribution is symmetric about mu).
   */
  skewness () {
    return 0
  }

  /**
   * @returns {number} Excess kurtosis of the distribution.
   */
  kurtosis () {
    return Math.exp(logGamma(5 / this.p.beta2) + logGamma(1 / this.p.beta2) - 2 * logGamma(3 / this.p.beta2)) - 3
  }

  static _fitInit (data) {
    // Seed at beta=2 (normal special case) with MOM estimates; beta's MOM inversion requires log-moment ratios unavailable from mean/std alone
    const n = data.length
    const mu = data.reduce((s, x) => s + x, 0) / n
    const alpha = Math.sqrt(data.reduce((s, x) => s + (x - mu) ** 2, 0) / n) || 1
    return [mu, alpha, 2]
  }
}
