import Beta from './beta'
import Distribution from './_distribution'

/**
 * Generator for the [beta-rectangular distribution]{@link https://en.wikipedia.org/wiki/Beta_rectangular_distribution}:
 *
 * $$f(x; \alpha, \beta, \theta, a, b) = \theta \frac{(x - a)^{\alpha - 1} (b - x)^{\beta - 1}}{\mathrm{B}(\alpha, \beta) (b - a)^{\alpha + \beta - 1}} + \frac{1 - \theta}{b - a},$$
 *
 * with \(\alpha, \beta > 0\), \(\theta \in [0, 1]\), \(a, b \in \mathbb{R}\), \(a < b\) and \(\mathrm{B}(x, y)\) is the beta function. Support: \(x \in [a, b]\).
 *
 * @class BetaRectangular
 * @memberof ran.dist
 * @param {number=} alpha First shape parameter. Default value is 1.
 * @param {number=} beta Second shape parameter. Default value is 1.
 * @param {number=} theta Mixture parameter. Default value is 0.5.
 * @param {number=} a Lower boundary of the support. Default value is 0.
 * @param {number=} b Upper boundary of the support. Default value is 1.
 * @constructor
 */
export default class extends Beta {
  constructor (alpha = 1, beta = 1, theta = 0.5, a = 0, b = 1) {
    super(alpha, beta)

    // Validate parameters
    this.p = Object.assign(this.p, { theta, a, b })
    Distribution.validate({ theta, a, b }, [
      'theta >= 0', 'theta <= 1',
      'a < b'
    ])

    // Set support
    this.s = [{
      value: a,
      closed: true
    }, {
      value: b,
      closed: true
    }]

    // Speed-up constants. Note that Beta has 3 speed-up constants
    this.c = this.c.concat([
      b - a,
      1 - theta
    ])
  }

  _generator () {
    // Direct sampling by mixing beta and uniform variates
    return this.r.next() < this.p.theta
      ? super._generator() * this.c[3] + this.p.a
      : this.r.next() * this.c[3] + this.p.a
  }

  _pdf (x) {
    return (this.p.theta * super._pdf((x - this.p.a) / this.c[3]) + this.c[4]) / this.c[3]
  }

  _cdf (x) {
    const y = x - this.p.a
    return this.p.theta * super._cdf(y / this.c[3]) + this.c[4] * y / this.c[3]
  }
}
