import logGamma from '../special/log-gamma'
import { gammaLowerIncomplete } from '../special/gamma-incomplete'
import { gamma } from './_core'
import Distribution from './_distribution'

/**
 * Generator for the [Hoyt distribution]{@link https://en.wikipedia.org/wiki/Nakagami_distribution} (also known as
 * Nakagami-q distribution):
 *
 * $$f(x; q, \omega) = \frac{2q^q}{\Gamma(q) \omega^q} x^{2q - 1} e^{-\frac{q}{\omega} x^2},$$
 *
 * where \(q \in (0, 1]\) and \(\omega > 0\). Support: \(x > 0\).
 *
 * @class Hoyt
 * @memberOf ran.dist
 * @param {number=} q Shape parameter. Default value is 0.5.
 * @param {number=} omega Spread parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (q = 0.5, omega = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { q, omega }
    Distribution._validate({ q, omega }, [
      'q > 0', 'q <= 1',
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
      2 * Math.pow(this.p.q, this.p.q) / Math.pow(this.p.omega, this.p.q)
    ]
  }

  _generator () {
    // Direct sampling from gamma
    return Math.sqrt(gamma(this.r, this.p.q, this.p.q / this.p.omega))
  }

  _pdf (x) {
    let z = Math.pow(x, 2 * this.p.q - 1)

    // Handle q < 0.5 and x << 0 case
    if (!isFinite(z)) {
      return 0
    } else {
      return 2 * Math.exp(this.p.q * Math.log(this.p.q) - this.p.q * x * x / this.p.omega - logGamma(this.p.q) - this.p.q * Math.log(this.p.omega)) * z
    }
  }

  _cdf (x) {
    return gammaLowerIncomplete(this.p.q, this.p.q * x * x / this.p.omega)
  }
}
