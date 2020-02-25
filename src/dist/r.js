import Beta from './beta'
import Distribution from './_distribution'

/**
 * Generator for the [R distribution]{@link https://docs.scipy.org/doc/scipy/reference/tutorial/stats/continuous_rdist.html}:
 *
 * $$f(x; c) = \frac{(1 - x^2)^{\frac{c}{2} - 1}}{\mathrm{B}\big(\frac{1}{2}, \frac{c}{2}\big)},$$
 *
 * where \(c > 0\). Support: \(x \in [-1, 1]\).
 *
 * @class R
 * @memberOf ran.dist
 * @param {number=} c Shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Beta {
  constructor (c = 1) {
    super(0.5, c / 2)

    // Validate parameters
    this.p = Object.assign(this.p, { c })
    Distribution.validate({ c }, [
      'c > 0'
    ])

    // Set support
    this.s = [{
      value: -1,
      closed: true
    }, {
      value: 1,
      closed: true
    }]
  }

  _generator () {
    return 2 * Math.sqrt(super._generator()) - 1
  }

  _pdf (x) {
    const y = (x + 1) / 2
    return y * super._pdf(y * y)
  }

  _cdf (x) {
    const y = (x + 1) / 2
    return super._cdf(y * y)
  }
}
