import Gamma from './gamma'

/**
 * Generator for the [double gamma distribution]{@link https://docs.scipy.org/doc/scipy/reference/tutorial/stats/continuous_dgamma.html} (with the same shape/rate parametrization that the [gamma distribution]{@link #dist.Gamma} uses):
 *
 * $$f(x; \alpha, \beta) = \frac{\beta^\alpha}{2 \Gamma(\alpha)} |x|^{\alpha - 1} e^{-\beta |x|},$$
 *
 * where \(\alpha, \beta > 0\). Support: \(x \in \mathbb{R}\).
 *
 * @class DoubleGamma
 * @memberOf ran.dist
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @param {number=} beta Rate parameter. Default value is 1.
 * @constructor
 */
export default class extends Gamma {
  constructor (alpha = 1, beta = 1) {
    super(alpha, beta)

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    return super._generator() * (this.r.next() < 0.5 ? -1 : 1)
  }

  _pdf (x) {
    return super._pdf(Math.abs(x)) / 2
  }

  _cdf (x) {
    const y = super._cdf(Math.abs(x))
    return (x > 0 ? 1 + y : 1 - y) / 2
  }
}
