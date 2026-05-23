import { gammaUpperIncomplete } from '../special'
import Gamma from './gamma'

/**
 * Generator for the [inverse gamma distribution]{@link https://en.wikipedia.org/wiki/Inverse-gamma_distribution}:
 *
 * $f(x; \alpha, \beta) = \frac{\beta^\alpha}{\Gamma(\alpha)} x^{-\alpha - 1} e^{-\beta/x},$
 *
 * where $\alpha, \beta > 0$. Support: $x > 0$.
 *
 * @class InverseGamma
 * @memberof ran.dist
 * @see https://en.wikipedia.org/wiki/Inverse-gamma_distribution
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

    // Speed-up constants
    this.c = { betaAlpha: Math.pow(beta, alpha) }
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
}
