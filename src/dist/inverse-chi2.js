import { gammaLowerIncomplete, logGamma } from '../special'
import chi2 from './_chi2'
import Distribution from './_distribution'

/**
 * Generator for the [inverse $\chi^2$ distribution]{@link https://en.wikipedia.org/wiki/Inverse-chi-squared_distribution}:
 *
 * $$f(x; \nu) = \frac{2^{-\nu/2}}{\Gamma(\nu / 2)} x^{-\nu/2 - 1} e^{-1/(2x)},$$
 *
 * with $\nu > 0$. Support: $x > 0$.
 *
 * @class InverseChi2
 * @memberof ran.dist
 * @param {number=} nu Degrees of freedom. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (nu = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    const nui = Math.round(nu)
    this.p = { nu: nui }
    Distribution.validate({ nu: nui }, [
      'nu > 0'
    ])

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
    // Direct sampling
    return 1 / chi2(this.r, this.p.nu)
  }

  _pdf (x) {
    return Math.pow(2, -this.p.nu / 2) * Math.pow(x, -this.p.nu / 2 - 1) * Math.exp(-0.5 / x - logGamma(this.p.nu / 2))
  }

  _cdf (x) {
    return 1 - gammaLowerIncomplete(this.p.nu / 2, 0.5 / x)
  }
}
