import InverseGaussian from './inverse-gaussian'

/**
 * Probability density function for the [reciprocal inverse Gaussian distribution (RIG)]{@link https://docs.scipy.org/doc/scipy-1.7.0/reference/tutorial/stats/continuous_recipinvgauss.html}:
 *
 * $f(x; \lambda, \mu) = \bigg\[\frac{\lambda}{2 \pi x}\bigg\]^{1/2} e^{\frac{-\lambda (1 - \mu x)^2}{2 \mu^2 x}},$
 *
 * with $\mu, \lambda > 0$. Support: $x > 0$.
 *
 * Cumulative distribution function:
 *
 * $F(x; \mu, \lambda) = 1 - F_{\mathrm{IG}}(1/x;\, \mu,\, \lambda)$
 *
 * where $F_{\mathrm{IG}}$ is the inverse Gaussian CDF
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

  static _fitInit (data) {
    // X~RIG(mu,lambda) iff 1/X~IG(mu,lambda); apply IG MOM to the reciprocal sample
    const inv = data.map(x => 1 / x)
    const n = inv.length
    const mean = inv.reduce((s, x) => s + x, 0) / n
    const variance = inv.reduce((s, x) => s + (x - mean) ** 2, 0) / n || mean * mean
    return [mean, mean * mean * mean / variance]
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
