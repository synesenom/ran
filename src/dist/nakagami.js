import logGamma from '../special/log-gamma'
import { gammaLowerIncomplete } from '../special/gamma-incomplete'
import { gamma } from './_core'
import Distribution from './_distribution'

/**
 * Generator for the [Nakagami distribution]{@link https://en.wikipedia.org/wiki/Nakagami_distribution}:
 *
 * $$f(x; m, \Omega) = \frac{2m^m}{\Gamma(m) \Omega^m} x^{2m - 1} e^{-\frac{m}{\Omega} x^2},$$
 *
 * where $m \in \mathbb{R}$, $m \ge 0.5$ and $\Omega > 0$. Support: $x > 0$.
 *
 * @class Nakagami
 * @memberof ran.dist
 * @param {number=} m Shape parameter. Default value is 1.
 * @param {number=} omega Spread parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (m = 1, omega = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { m, omega }
    Distribution.validate({ m, omega }, [
      'm >= 0.5',
      'omega > 0'
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
    this.c = [
      2 * Math.pow(this.p.m, this.p.m) / Math.pow(this.p.omega, this.p.m)
    ]
  }

  _generator () {
    // Direct sampling from gamma
    return Math.sqrt(gamma(this.r, this.p.m, this.p.m / this.p.omega))
  }

  _pdf (x) {
    return this.c[0] * Math.pow(x, 2 * this.p.m - 1) * Math.exp(-this.p.m * x * x / this.p.omega - logGamma(this.p.m))
  }

  _cdf (x) {
    return gammaLowerIncomplete(this.p.m, this.p.m * x * x / this.p.omega)
  }
}
