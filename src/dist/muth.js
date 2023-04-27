// https://journals.vgtu.lt/index.php/MMA/article/view/1001/767

import Distribution from './_distribution'
import { lambertW1m } from '../special'

/**
 * Generator for the [Muth distribution]{@link https://www.tandfonline.com/doi/abs/10.3846/13926292.2015.1048540:
 *
 * $$f(x; \alpha) = (e^{\alpha x} - \alpha) \exp\bigg(\alpha x - \frac{1}{\alpha} (e^{\alpha x} - 1)\bigg),$$
 *
 * with $\alpha \in (0, 1]$. Support: $x > 0$.
 *
 * @class Muth
 * @memberof ran.dist
 * @param {number=} alpha Shape parameter. Default value is 0.5.
 * @constructor
 */
export default class extends Distribution {
  constructor (alpha = 0.5) {
    super('continuous', arguments.length)

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

  _survival (x) {
    return Math.exp(this.p.alpha * x - (Math.exp(this.p.alpha * x) - 1) / this.p.alpha)
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return (Math.exp(this.p.alpha * x) - this.p.alpha) * this._survival(x)
  }

  _cdf (x) {
    return 1 - this._survival(x)
  }

  _q (p) {
    // Using Eq. (3.2) in Jodra et al: On the Muth Distribution
    return (Math.log(1 - p) - lambertW1m((p - 1) / (this.p.alpha * Math.exp(1 / this.p.alpha))) - 1 / this.p.alpha) / this.p.alpha
  }
}
