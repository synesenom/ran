import InverseGaussian from './inverse-gaussian'

/**
 * Probability function for the [reciprocal inverse Gaussian distribution (RIG)]{@link https://docs.scipy.org/doc/scipy-1.7.0/reference/tutorial/stats/continuous_recipinvgauss.html}:
 *
 * $f(x; \lambda, \mu) = \bigg\[\frac{\lambda}{2 \pi x}\bigg\]^{1/2} e^{\frac{-\lambda (1 - \mu x)^2}{2 \mu^2 x}},$
 *
 * with $\mu, \lambda > 0$. Support: $x > 0$.
 *
 * @class ReciprocalInverseGaussian
 * @memberof ran.dist
 * @constructor
 */
export default class ReciprocalInverseGaussian extends InverseGaussian {
  /**
   * @param {number} mu Mean of the inverse Gaussian distribution.
   * @param {number} lambda Shape parameter.
   */
  constructor (mu, lambda) {
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
