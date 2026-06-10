import { gammaLowerIncompleteInv, logGamma } from '../special'
import GeneralizedNormal from './generalized-normal'

/**
 * Probability density function for the [half generalized normal distribution]{@link https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.halfgennorm.html}:
 *
 * $f(x; \alpha, \beta) = \frac{\beta}{\alpha \, \Gamma\big(\frac{1}{\beta}\big)} e^{-\big(\frac{x}{\alpha}\big)^\beta},$
 *
 * with $\alpha, \beta > 0$. Support: $x > 0$.
 *
 * Cumulative distribution function:
 *
 * $F(x; \alpha, \beta) = P\!\left(\frac{1}{\beta},\, \left(\frac{x}{\alpha}\right)^{\beta}\right)$
 *
 * @class HalfGeneralizedNormal
 * @memberof ran.dist
 * @constructor
 */
export default class HalfGeneralizedNormal extends GeneralizedNormal {
  /**
   * @param {number} alpha Scale parameter.
   * @param {number} beta Shape parameter.
   */
  constructor (alpha, beta) {
    super(0, alpha, beta)

    // HalfGeneralizedNormal has 2 free parameters (alpha, beta); override the 3 inherited from GeneralizedNormal
    this.k = 2

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  /**
   * @returns {number} Mean of the distribution.
   */
  mean () {
    const lgInv = logGamma(1 / this.p.beta2)
    return this.p.alpha2 * Math.exp(logGamma(2 / this.p.beta2) - lgInv)
  }

  /**
   * @returns {number} Variance of the distribution.
   */
  variance () {
    const lgInv = logGamma(1 / this.p.beta2)
    const m1 = this.p.alpha2 * Math.exp(logGamma(2 / this.p.beta2) - lgInv)
    const m2 = this.p.alpha2 ** 2 * Math.exp(logGamma(3 / this.p.beta2) - lgInv)
    return m2 - m1 * m1
  }

  /**
   * @returns {number} Skewness of the distribution.
   */
  skewness () {
    const lgInv = logGamma(1 / this.p.beta2)
    const m1 = this.p.alpha2 * Math.exp(logGamma(2 / this.p.beta2) - lgInv)
    const m2 = this.p.alpha2 ** 2 * Math.exp(logGamma(3 / this.p.beta2) - lgInv)
    const m3 = this.p.alpha2 ** 3 * Math.exp(logGamma(4 / this.p.beta2) - lgInv)
    const v = m2 - m1 * m1
    return (m3 - 3 * m1 * m2 + 2 * m1 ** 3) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} Excess kurtosis of the distribution.
   */
  kurtosis () {
    const lgInv = logGamma(1 / this.p.beta2)
    const m1 = this.p.alpha2 * Math.exp(logGamma(2 / this.p.beta2) - lgInv)
    const m2 = this.p.alpha2 ** 2 * Math.exp(logGamma(3 / this.p.beta2) - lgInv)
    const m3 = this.p.alpha2 ** 3 * Math.exp(logGamma(4 / this.p.beta2) - lgInv)
    const m4 = this.p.alpha2 ** 4 * Math.exp(logGamma(5 / this.p.beta2) - lgInv)
    const v = m2 - m1 * m1
    return (m4 - 4 * m1 * m3 + 6 * m1 ** 2 * m2 - 3 * m1 ** 4) / (v * v) - 3
  }

  _q (p) {
    // HalfGeneralizedNormal CDF = GenGamma.cdf(x); quantile is the plain GenGamma inverse
    return Math.pow(gammaLowerIncompleteInv(this.p.alpha, p) / this.p.beta, 1 / this.p.p)
  }

  _generator () {
    // Direct sampling by transforming normal variate
    return Math.abs(super._generator())
  }

  _pdf (x) {
    return 2 * super._pdf(x)
  }

  _cdf (x) {
    return 2 * super._cdf(x) - 1
  }

  static _fitInit (data) {
    // At beta=2 (half-normal), E[X] = alpha/sqrt(pi); inverting gives alpha from the sample mean
    const n = data.length
    const meanAbs = data.reduce((s, x) => s + x, 0) / n
    return [Math.max(meanAbs * Math.sqrt(Math.PI), 1e-3), 2]
  }
}
