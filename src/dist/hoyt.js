import { gammaLn, gammaLowerIncomplete } from '../special'
import { gamma } from './_standard'
import Distribution from './_distribution'

/**
 * Generator for the [Hoyt distribution]{@link https://en.wikipedia.org/wiki/Nakagami_distribution} (also known as
 * Nakagami-q distribution):
 *
 * $$f(x; q, \omega) = \frac{2q^q}{\Gamma(q) \omega^q} x^{2q - 1} e^{-\frac{q}{\omega} x^2},$$
 *
 * where \(q \in (0, 1]\) and \(\omega \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
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
    this.p = { q, omega }
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: null,
      closed: false
    }]
    this.c = [2 * Math.pow(this.p.q, this.p.q) / Math.pow(this.p.omega, this.p.q)]
  }

  _generator () {
    // Direct sampling from gamma
    return Math.sqrt(gamma(this.p.q, this.p.q / this.p.omega))
  }

  _pdf (x) {
    return this.c[0] * Math.pow(x, 2 * this.p.q - 1) * Math.exp(-this.p.q * x * x / this.p.omega - gammaLn(this.p.q))
  }

  _cdf (x) {
    return gammaLowerIncomplete(this.p.q, this.p.q * x * x / this.p.omega)
  }
}
