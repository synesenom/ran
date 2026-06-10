import { gammaUpperIncomplete, gammaLowerIncompleteInv } from '../special'
import Gamma from './gamma'

/**
 * Probability density function for the [inverse gamma distribution]{@link https://en.wikipedia.org/wiki/Inverse-gamma_distribution}:
 *
 * $f(x; \alpha, \beta) = \frac{\beta^\alpha}{\Gamma(\alpha)} x^{-\alpha - 1} e^{-\beta/x},$
 *
 * where $\alpha, \beta > 0$. Support: $x > 0$.
 *
 * Cumulative distribution function:
 *
 * $F(x; \alpha, \beta) = Q(\alpha,\, \beta/x)$
 *
 * @class InverseGamma
 * @memberof ran.dist
 * @constructor
 */
export default class InverseGamma extends Gamma {
  // Transformation of gamma distribution
  /**
   * @param {number} alpha Shape parameter.
   * @param {number} beta Scale parameter.
   */
  constructor (alpha, beta) {
    super(alpha, beta)

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
    // Direct sampling by transforming gamma variate
    return 1 / super._generator()
  }

  _pdf (x) {
    return super._pdf(1 / x) / (x * x)
  }

  _cdf (x) {
    // Direct upper gamma avoids catastrophic cancellation when beta/x is large (x near 0)
    return gammaUpperIncomplete(this.p.alpha, this.p.beta / x)
  }

  _q (p) {
    // CDF = Q(alpha, beta/x) = p → beta/x = invGL(alpha, 1-p) → x = beta / invGL(alpha, 1-p)
    return this.p.beta / gammaLowerIncompleteInv(this.p.alpha, 1 - p)
  }

  /**
   * @returns {number} Scale divided by (shape - 1); `Infinity` for shape <= 1.
   */
  mean () {
    const { alpha, beta } = this.p
    if (alpha <= 1) return Infinity
    return beta / (alpha - 1)
  }

  /**
   * @returns {number} Squared scale over (shape-1)^2*(shape-2); `Infinity` for shape <= 2.
   */
  variance () {
    const { alpha, beta } = this.p
    if (alpha <= 2) return Infinity
    return beta ** 2 / ((alpha - 1) ** 2 * (alpha - 2))
  }

  /**
   * @returns {number} 4*sqrt(shape-2)/(shape-3); `Infinity` for shape <= 3.
   */
  skewness () {
    const { alpha } = this.p
    if (alpha <= 3) return Infinity
    return 4 * Math.sqrt(alpha - 2) / (alpha - 3)
  }

  /**
   * @returns {number} (30*shape-66)/((shape-3)*(shape-4)); `Infinity` for shape <= 4.
   */
  kurtosis () {
    const { alpha } = this.p
    if (alpha <= 4) return Infinity
    return (30 * alpha - 66) / ((alpha - 3) * (alpha - 4))
  }

  static _fitInit (data) {
    // E[X]=β/(α−1), Var/E²=1/(α−2) → α = 2 + mean²/var, β = mean·(α−1)
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1
    const alpha = 2 + mean ** 2 / variance
    return [alpha, mean * (alpha - 1)]
  }
}
