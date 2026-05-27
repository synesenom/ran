import { lambertW0 } from '../special'
import Distribution from './_distribution'

/**
 * Probability density function for the [Makeham distribution]{@link https://en.wikipedia.org/wiki/Gompertz%E2%80%93Makeham_law_of_mortality}
 * (also known as Gompertz-Makeham distribution):
 *
 * $f(x; \alpha, \beta, \lambda) = (\alpha e^{\beta x} + \lambda) \exp\Big\[{-\lambda x - \frac{\alpha}{\beta}(e^{\beta x} - 1)}\Big\],$
 *
 * with $\alpha, \beta, \lambda > 0$. Support: $x > 0$.
 *
 * @class Makeham
 * @memberof ran.dist
 * @constructor
 */
export default class Makeham extends Distribution {
  /**
   * @param {number} alpha Shape parameter.
   * @param {number} beta Rate parameter.
   * @param {number} lambda Scale parameter.
   */
  constructor (alpha, beta, lambda) {
    super('continuous', 3)

    // Validate parameters.
    this.p = { alpha, beta, lambda }
    Distribution.validate({ alpha, beta, lambda }, [
      'alpha > 0',
      'beta > 0',
      'lambda > 0'
    ])

    // Set support.
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants.
    this.c = {
      alphaOverBetaLambda: alpha / (beta * lambda),
      expFactor: alpha * Math.exp(alpha / lambda) / lambda,
      negBetaOverLambda: -beta / lambda
    }
  }

  _generator () {
    // Inverse transform sampling.
    return this._q(this.r.next())
  }

  _pdf (x) {
    const y = Math.exp(this.p.beta * x)

    // Handle y >> 1 cases.
    if (Number.isFinite(Math.exp(y))) {
      return (this.p.alpha * y + this.p.lambda) * Math.exp(-this.p.lambda * x - this.p.alpha * (y - 1) / this.p.beta)
    } else {
      return 0
    }
  }

  _cdf (x) {
    // expm1(beta*x) for exp(beta*x)-1; outer -expm1 avoids cancellation in 1-exp(-) near x=0
    return -Math.expm1(-this.p.lambda * x - this.p.alpha * Math.expm1(this.p.beta * x) / this.p.beta)
  }

  _q (p) {
    const z = this.c.expFactor * Math.pow(1 - p, this.c.negBetaOverLambda)

    // Handle z >> 1 case.
    const w = lambertW0(z)
    if (Number.isFinite(w)) {
      return this.c.alphaOverBetaLambda - Math.log(1 - p) / this.p.lambda - w / this.p.beta
    } else {
      const t = Math.log(this.c.expFactor) + this.c.negBetaOverLambda * Math.log(1 - p)
      return this.c.alphaOverBetaLambda - Math.log(1 - p) / this.p.lambda - (t - Math.log(t)) / this.p.beta
    }
  }
}
