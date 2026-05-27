import Gamma from './gamma'

/**
 * Probability function for the [double gamma distribution]{@link https://docs.scipy.org/doc/scipy/tutorial/stats/continuous_dgamma.html}
 * (with the same shape/rate parametrization that the [gamma distribution]{@link #dist.Gamma} uses):
 *
 * $f(x; \alpha, \beta) = \frac{\beta^\alpha}{2 \Gamma(\alpha)} |x|^{\alpha - 1} e^{-\beta |x|},$
 *
 * where $\alpha, \beta > 0$. Support: $x \in \mathbb{R}$.
 *
 * @class DoubleGamma
 * @memberof ran.dist
 * @constructor
 */
export default class DoubleGamma extends Gamma {
  // Transformation of gamma
  /**
   * @param {number} alpha Shape parameter.
   * @param {number} beta Rate parameter.
   */
  constructor (alpha, beta) {
    super(alpha, beta)
    this._q = undefined // Gamma._q is wrong for the double-sided transform; fall back to _qEstimateRoot

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
