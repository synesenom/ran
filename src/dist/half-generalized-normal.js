import { gammaLowerIncompleteInv } from '../special'
import GeneralizedNormal from './generalized-normal'

/**
 * Probability density function for the [half generalized normal distribution]{@link https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.halfgennorm.html}:
 *
 * $f(x; \alpha, \beta) = \frac{\beta}{\alpha \Gamma\big(\frac{1}{\beta}\big)} e^{-\big(\frac{x}{\alpha}\big)^\beta},$
 *
 * with $\alpha, \beta > 0$. Support: $x > 0$.
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
    // lG0..lG4 = logGamma(j/beta) for j=1..5, already cached by GeneralizedGamma's constructor.
    return this.p.alpha * Math.exp(this.c.lG1 - this.c.lG0)
  }

  /**
   * @returns {number} Variance of the distribution.
   */
  variance () {
    const { lG0, lG1, lG2 } = this.c
    const m1 = this.p.alpha * Math.exp(lG1 - lG0)
    const m2 = this.p.alpha ** 2 * Math.exp(lG2 - lG0)
    return m2 - m1 * m1
  }

  /**
   * @returns {number} Skewness of the distribution.
   */
  skewness () {
    const { lG0, lG1, lG2, lG3 } = this.c
    const m1 = this.p.alpha * Math.exp(lG1 - lG0)
    const m2 = this.p.alpha ** 2 * Math.exp(lG2 - lG0)
    const m3 = this.p.alpha ** 3 * Math.exp(lG3 - lG0)
    const v = m2 - m1 * m1
    return (m3 - 3 * m1 * m2 + 2 * m1 ** 3) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} Excess kurtosis of the distribution.
   */
  kurtosis () {
    const { lG0, lG1, lG2, lG3, lG4 } = this.c
    const m1 = this.p.alpha * Math.exp(lG1 - lG0)
    const m2 = this.p.alpha ** 2 * Math.exp(lG2 - lG0)
    const m3 = this.p.alpha ** 3 * Math.exp(lG3 - lG0)
    const m4 = this.p.alpha ** 4 * Math.exp(lG4 - lG0)
    const v = m2 - m1 * m1
    return (m4 - 4 * m1 * m3 + 6 * m1 ** 2 * m2 - 3 * m1 ** 4) / (v * v) - 3
  }

  _q (p) {
    // HalfGeneralizedNormal CDF = GenGamma.cdf(x); quantile is the plain GenGamma inverse.
    // this.c.alpha/this.c.beta are GeneralizedGamma's own Gamma-space constants (unaffected by
    // this class); the GG-level shape exponent equals this class's own natural beta.
    return Math.pow(gammaLowerIncompleteInv(this.c.alpha, p) / this.c.beta, 1 / this.p.beta)
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
