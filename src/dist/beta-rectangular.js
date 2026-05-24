import Beta from './beta'
import Distribution from './_distribution'

/**
 * Generator for the [beta-rectangular distribution]{@link https://en.wikipedia.org/wiki/Beta_rectangular_distribution}:
 *
 * $f(x; \alpha, \beta, \theta, a, b) = \theta \frac{(x - a)^{\alpha - 1} (b - x)^{\beta - 1}}{\mathrm{B}(\alpha, \beta) (b - a)^{\alpha + \beta - 1}} + \frac{1 - \theta}{b - a},$
 *
 * with $\alpha, \beta > 0$, $\theta \in \[0, 1\]$, $a, b \in \mathbb{R}$, $a < b$ and $\mathrm{B}(x, y)$ is the beta function. Support: $x \in \[a, b\]$.
 *
 * @class BetaRectangular
 * @memberof ran.dist
 * @constructor
 */
export default class BetaRectangular extends Beta {
  /**
   * @param {number} alpha First shape parameter.
   * @param {number} beta Second shape parameter.
   * @param {number} theta Mixture parameter.
   * @param {number} a Lower boundary of the support.
   * @param {number} b Upper boundary of the support.
   */
  constructor (alpha, beta, theta, a, b) {
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

    // Speed-up constants
    Object.assign(this.c, {
      bMinusA: b - a,
      oneMinusTheta: 1 - theta
    })
  }

  _generator () {
    // Direct sampling by mixing beta and uniform variates
    return this.r.next() < this.p.theta
      ? super._generator() * this.c.bMinusA + this.p.a
      : this.r.next() * this.c.bMinusA + this.p.a
  }

  _pdf (x) {
    return (this.p.theta * super._pdf((x - this.p.a) / this.c.bMinusA) + this.c.oneMinusTheta) / this.c.bMinusA
  }

  _cdf (x) {
    const y = x - this.p.a
    return this.p.theta * super._cdf(y / this.c.bMinusA) + this.c.oneMinusTheta * y / this.c.bMinusA
  }
}
