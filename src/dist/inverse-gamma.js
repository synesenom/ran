import { gammaUpperIncomplete, gammaLowerIncompleteInv } from '../special'
import Gamma from './gamma'

/**
 * Probability density function for the [inverse gamma distribution]{@link https://en.wikipedia.org/wiki/Inverse-gamma_distribution}:
 *
 * $f(x; \alpha, \beta) = \frac{\beta^\alpha}{\Gamma(\alpha)} x^{-\alpha - 1} e^{-\beta/x},$
 *
 * where $\alpha, \beta > 0$. Support: $x > 0$.
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

  static _fitInit (data) {
    // E[X]=β/(α−1), Var/E²=1/(α−2) → α = 2 + mean²/var, β = mean·(α−1)
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1
    const alpha = 2 + mean ** 2 / variance
    return [alpha, mean * (alpha - 1)]
  }
}
