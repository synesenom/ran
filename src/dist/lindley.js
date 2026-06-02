import Distribution from './_distribution'
import { lambertW1m } from '../special'

/**
 * Probability density function for the [Lindley distribution]{@link http://www.hjms.hacettepe.edu.tr/uploads/b35d591c-22f6-4136-8735-20c82936cd64.pdf}:
 *
 * $f(x; \theta) = \frac{\theta^2}{1 + \theta} (1 + x) e^{-\theta x},$
 *
 * with $\theta > 0$. Support: $x \ge 0$.
 *
 * @class Lindley
 * @memberof ran.dist
 * @constructor
 */
export default class Lindley extends Distribution {
  /**
   * @param {number} theta Shape parameter.
   */
  constructor (theta) {
    super('continuous', 1)

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
    this.c = {
      thetaP1: 1 + theta,
      expFactor: Math.exp(-theta - 1) * (1 + theta)
    }
  }

  static get _fitInitIsExact () {
    // _fitInit returns the exact closed-form MLE, so fit() skips the optimizer (ADR-0016).
    return true
  }

  static _fitInit (data) {
    // Closed-form MOM: positive root of m·θ² + (m−1)·θ − 2 = 0 where m = mean
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const disc = (mean - 1) * (mean - 1) + 8 * mean
    return [Math.max((-(mean - 1) + Math.sqrt(disc)) / (2 * mean), 1e-3)]
  }

  _generator () {
    // Inverse transform sampling using Lambert W.
    return -(lambertW1m(-this.r.next() * this.c.expFactor) + this.c.thetaP1) / this.p.theta
  }

  _pdf (x) {
    return this.p.theta * this.p.theta * (1 + x) * Math.exp(-this.p.theta * x) / this.c.thetaP1
  }

  _cdf (x) {
    const tx = this.p.theta * x
    // -expm1(-tx) avoids catastrophic cancellation when theta*x is near 0
    return -Math.expm1(-tx) - Math.exp(-tx) * tx / this.c.thetaP1
  }

  _q (p) {
    // F(x)=p inverts in closed form via Lambert W. x >= 0 forces the argument below -1, so
    // the W_{-1} branch is the correct root. The (1 - p) tail mirrors _generator.
    return -(lambertW1m(-(1 - p) * this.c.expFactor) + this.c.thetaP1) / this.p.theta
  }
}
