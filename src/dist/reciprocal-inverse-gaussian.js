import InverseGaussian from './inverse-gaussian'

/**
 * Generator for the [reciprocal inverse Gaussian distribution (RIG)]{@link https://docs.scipy.org/doc/scipy/reference/tutorial/stats/continuous_recipinvgauss.html}:
 *
 * $$f(x; \lambda, \mu) = \bigg[\frac{\lambda}{2 \pi x}\bigg]^{1/2} e^{\frac{-\lambda (1 - \mu x)^2}{2 \mu^2 x}},$$
 *
 * with \(\mu, \lambda > 0\). Support: \(x > 0\).
 *
 * @class ReciprocalInverseGaussian
 * @memberOf ran.dist
 * @param {number=} mu Mean of the inverse Gaussian distribution. Default value is 1.
 * @param {number=} lambda Shape parameter. Default value is 1.
 * @constructor
 */
export default class extends InverseGaussian {
  constructor (mu = 1, lambda = 1) {
    super(mu, lambda)

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    return 1 / super._generator()
  }

  _pdf (x) {
    return super._pdf(1 / x) / (x * x)
  }

  _cdf (x) {
    return 1 - super._cdf(1 / x)
  }
}
