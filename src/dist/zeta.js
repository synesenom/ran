import generalizedHarmonic from '../special/generalized-harmonic'
import riemannZeta from '../special/riemann-zeta'
import { zeta } from './_core'
import Distribution from './_distribution'

/**
 * Generator for the [zeta distribution]{@link https://en.wikipedia.org/wiki/Zeta_distribution}:
 *
 * $$f(k; s) = \frac{k^{-s}}{\zeta(s)},$$
 *
 * with \(s \in (1, \infty)\) and \(\zeta(x)\) is the Riemann zeta function. Support: \(k \in \mathbb{N}^+\).
 *
 * @class Zeta
 * @memberof ran.dist
 * @param {number=} s Exponent of the distribution. Default value is 3.
 * @constructor
 */
export default class extends Distribution {
  constructor (s = 3) {
    super('discrete', arguments.length)

    // Validate parameters
    this.p = { s }
    Distribution.validate({ s }, [
      's > 1'
    ])

    // Set support
    this.s = [{
      value: 1,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    this.c = [
      riemannZeta(s), Math.pow(2, s - 1)
    ]
  }

  _generator () {
    // Rejection sampling
    return zeta(this.r, this.p.s)
  }

  _pdf (x) {
    return Math.pow(x, -this.p.s) / this.c[0]
  }

  _cdf (x) {
    return generalizedHarmonic(x, this.p.s) / this.c[0]
  }
}
