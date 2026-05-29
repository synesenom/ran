// https://journals.vgtu.lt/index.php/MMA/article/view/1001/767

import Distribution from './_distribution'
import { lambertW1m } from '../special'

/**
 * Probability density function for the [Muth distribution]{@link https://www.tandfonline.com/doi/abs/10.3846/13926292.2015.1048540}:
 *
 * $f(x; \alpha) = (e^{\alpha x} - \alpha) \exp\bigg(\alpha x - \frac{1}{\alpha} (e^{\alpha x} - 1)\bigg),$
 *
 * with $\alpha \in (0, 1]$. Support: $x > 0$.
 *
 * @class Muth
 * @memberof ran.dist
 * @constructor
 */
export default class Muth extends Distribution {
  /**
   * @param {number} alpha Shape parameter.
   */
  constructor (alpha) {
    super('continuous', 1)

    // Validate parameters
    this.p = { alpha }
    Distribution.validate({ alpha }, [
      'alpha > 0', 'alpha <= 1'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  static _fitInit (data) {
    // Single param bounded in (0,1] with no closed-form MOM; default 0.5 nudged toward smaller alpha for larger means
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    return [Math.min(1, Math.max(0.5 / Math.max(mean, 1), 0.1))]
  }

  _survival (x) {
    return Math.exp(this.p.alpha * x - Math.expm1(this.p.alpha * x) / this.p.alpha)
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return (Math.exp(this.p.alpha * x) - this.p.alpha) * this._survival(x)
  }

  _cdf (x) {
    // -expm1 avoids cancellation in 1 - survival(x) near x=0
    return -Math.expm1(this.p.alpha * x - Math.expm1(this.p.alpha * x) / this.p.alpha)
  }

  _q (p) {
    // Using Eq. (3.2) in Jodra et al: On the Muth Distribution
    return (Math.log(1 - p) - lambertW1m((p - 1) / (this.p.alpha * Math.exp(1 / this.p.alpha))) - 1 / this.p.alpha) / this.p.alpha
  }
}
