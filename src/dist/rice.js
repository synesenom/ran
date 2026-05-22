import { besselI, marcumP } from '../special'
import gamma from './_gamma'
import poisson from './_poisson'
import Distribution from './_distribution'

/**
 * Generator for the [Rice distribution]{@link https://en.wikipedia.org/wiki/Rice_distribution}:
 *
 * $$f(x; \nu, \sigma) = \frac{x}{\sigma^2} e^{-\frac{x^2 + \nu^2}{2 \sigma^2}} I_0\bigg(\frac{\nu x}{\sigma^2}\bigg),$$
 *
 * with $\nu, \sigma > 0$ and $I_0(x)$ is the modified Bessel function of the first kind with order zero. Support: $x \in [0, \infty)$.
 *
 * @class Rice
 * @memberof ran.dist
 * @param {number=} nu First shape parameter. Default value is 1.
 * @param {number=} sigma Second shape parameter. Default value is 1.
 * @see https://en.wikipedia.org/wiki/Rice_distribution
 * @constructor
 */
export default class extends Distribution {
  constructor (nu, sigma) {
    super('continuous', 2)

    // Validate parameters
    this.p = { nu, sigma }
    Distribution.validate({ nu, sigma }, [
      'nu > 0',
      'sigma > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    this.c = {
      halfNuSqRatio: 0.5 * Math.pow(nu / sigma, 2),
      sigma2: sigma * sigma,
      nuOverSigma2: nu / (sigma * sigma),
      nu2: nu * nu
    }
  }

  _generator () {
    // Direct sampling using Poisson and gamma
    const p = poisson(this.r, this.c.halfNuSqRatio)
    const x = gamma(this.r, p + 1, 0.5)
    return this.p.sigma * Math.sqrt(x)
  }

  _pdf (x) {
    const z = x * this.p.nu / this.c.sigma2
    const b = besselI(0, z)

    // Handle z >> 1 case (using asymptotic form of Bessel)
    if (Number.isFinite(b)) {
      return x * Math.exp(-0.5 * (x * x + this.c.nu2) / this.c.sigma2) * besselI(0, x * this.c.nuOverSigma2) / this.c.sigma2
    } else {
      return x * Math.exp(-0.5 * (x * x + this.c.nu2) / this.c.sigma2 + z - 0.5 * Math.log(2 * Math.PI * z)) / this.c.sigma2
    }
  }

  _cdf (x) {
    // Complementary Marcum Q avoids catastrophic cancellation in the
    // lower tail: `1 - marcumQ(...)` would lose precision because
    // marcumQ internally forms `1 - P` to deliver Q (#246).
    return marcumP(1, this.c.halfNuSqRatio, Math.pow(x / this.p.sigma, 2) / 2)
  }
}
