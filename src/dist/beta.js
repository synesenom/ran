import { regularizedBetaIncomplete, logBeta } from '../special'
import rBeta from './_beta'
import Distribution from './_distribution'

/**
 * Probability function for the [beta distribution]{@link https://en.wikipedia.org/wiki/Beta_distribution}:
 *
 * $f(x; \alpha, \beta) = \frac{x^{\alpha - 1}(1 - x)^{\beta - 1}}{\mathrm{B}(\alpha, \beta)},$
 *
 * with $\alpha, \beta > 0$ and $\mathrm{B}(\alpha, \beta)$ is the beta function.
 * Support: $x \in (0, 1)$.
 *
 * @class Beta
 * @memberof ran.dist
 * @constructor
 */
export default class Beta extends Distribution {
  /**
   * @param {number} alpha First shape parameter.
   * @param {number} beta Second shape parameter.
   */
  constructor (alpha, beta) {
    super('continuous', 2)

    // Validate parameters
    this.p = { alpha, beta }
    Distribution.validate({ alpha, beta }, [
      'alpha > 0',
      'beta > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: alpha >= 1
    }, {
      value: 1,
      closed: beta >= 1
    }]

    // Speed-up constants
    this.c = {
      lnBeta: logBeta(alpha, beta),
      alphaM1: alpha - 1,
      betaM1: beta - 1
    }
  }

  _generator () {
    // Direct generation
    return rBeta(this.r, this.p.alpha, this.p.beta)
  }

  _pdf (x) {
    if (this.c.alphaM1 === 0 && this.c.betaM1 === 0) {
      return 1
    }

    const a = this.c.alphaM1 * Math.log(x)

    const b = this.c.betaM1 * Math.log(1 - x)

    // Handle x = 0 and x = 1 cases
    return Math.exp(a + b - this.c.lnBeta)
  }

  _cdf (x) {
    return regularizedBetaIncomplete(this.p.alpha, this.p.beta, x)
  }
}
