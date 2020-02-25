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
 * @memberOf ran.dist
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

    // TODO Speed-up constants
  }

  _generator () {
    // Direct sampling by mixing beta and uniform variates
    return this.r.next() < this.p.theta
      ? super._generator() * (this.p.b - this.p.a) + this.p.a
      : this.r.next() * (this.p.b - this.p.a) + this.p.a
  }

  _pdf (x) {
    return this.p.theta * super._pdf((x - this.p.a) / (this.p.b - this.p.a)) / (this.p.b - this.p.a) + (1 - this.p.theta) / (this.p.b - this.p.a)
  }

  _cdf (x) {
    return this.p.theta * super._cdf((x - this.p.a) / (this.p.b - this.p.a)) + (1 - this.p.theta) * (x - this.p.a) / (this.p.b - this.p.a)
  }
}
