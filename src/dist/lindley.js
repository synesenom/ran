import { gamma, rejection } from './_core'
import Distribution from './_distribution'

/**
 * Generator for the [Lindley distribution]{@link http://www.hjms.hacettepe.edu.tr/uploads/b35d591c-22f6-4136-8735-20c82936cd64.pdf}:
 *
 * $$f(x; \theta) = \frac{\theta^2}{1 + \theta} (1 + x) e^{-\theta x},$$
 *
 * with \(\theta > 0\). Support: \(x \ge 0\).
 *
 * @class Lindley
 * @memberof ran.dist
 * @param {number=} theta Shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (theta = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { theta }
    Distribution.validate({ theta }, [
      'theta > 0'
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
      1 + theta,
      theta <= 2 ? theta * Math.exp(1 - theta / 2) / 2 : 1
    ]
  }

  _generator () {
    // Rejection sampling with gamma(1, theta/2) distribution as major
    return rejection(
      this.r,
      () => gamma(this.r, 1, this.p.theta / 2),
      x => this.c[1] * (1 + x) * Math.exp(-0.5 * this.p.theta * x)
    )
  }

  _pdf (x) {
    return this.p.theta * this.p.theta * (1 + x) * Math.exp(-this.p.theta * x) / this.c[0]
  }

  _cdf (x) {
    return 1 - Math.exp(-this.p.theta * x) * (this.c[0] + this.p.theta * x) / this.c[0]
  }
}
