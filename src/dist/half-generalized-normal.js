import { gammaLowerIncompleteInv } from '../special'
import GeneralizedNormal from './generalized-normal'

/**
 * Probability density function for the [half generalized normal distribution]{@link https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.halfgennorm.html}:
 *
 * $f(x; \alpha, \beta) = \frac{\beta}{\Gamma\big(\frac{1}{\beta}\big)} e^{-|x|^\beta},$
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
