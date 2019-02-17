import { gammaLn, gammaLowerIncomplete } from '../special'
import { gamma } from './_core'
import Distribution from './_distribution'

/**
 * Generator for the [Nakagami distribution]{@link https://en.wikipedia.org/wiki/Nakagami_distribution}:
 *
 * $$f(x; m, \Omega) = \frac{2m^m}{\Gamma(m) \Omega^m} x^{2m - 1} e^{-\frac{m}{\Omega} x^2},$$
 *
 * where \(m \in \mathbb{R}\), \(m \ge 0.5\) and \(\Omega \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
 *
 * @class Nakagami
 * @memberOf ran.dist
 * @param {number=} m Shape parameter. Default value is 1.
 * @param {number=} omega Spread parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (m = 1, omega = 1) {
    super('continuous', arguments.length)
    this.p = { m, omega }
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: null,
      closed: false
    }]
    this.c = [2 * Math.pow(this.p.m, this.p.m) / Math.pow(this.p.omega, this.p.m)]
  }

  _generator () {
    // Direct sampling from gamma
    return Math.sqrt(gamma(this.p.m, this.p.m / this.p.omega))
  }

  _pdf (x) {
    return this.c[0] * Math.pow(x, 2 * this.p.m - 1) * Math.exp(-this.p.m * x * x / this.p.omega - gammaLn(this.p.m))
  }

  _cdf (x) {
    return gammaLowerIncomplete(this.p.m, this.p.m * x * x / this.p.omega)
  }
}
