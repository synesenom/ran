import { gammaLowerIncompleteInv } from '../special'
import Gamma from './gamma'

/**
 * Probability density function for the [double gamma distribution]{@link https://docs.scipy.org/doc/scipy/tutorial/stats/continuous_dgamma.html}
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
    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _q (p) {
    // DoubleGamma is symmetric: positive half when p > 0.5, negative when p <= 0.5
    return p > 0.5
      ? gammaLowerIncompleteInv(this.p.alpha, 2 * p - 1) / this.p.beta
      : -gammaLowerIncompleteInv(this.p.alpha, 1 - 2 * p) / this.p.beta
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

  static _fitInit (data) {
    // |X| ~ Gamma(α,β): gamma MOM on absolute values
    const n = data.length
    const absData = data.map(x => Math.abs(x))
    const mean = absData.reduce((s, x) => s + x, 0) / n
    const variance = absData.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1
    return [mean ** 2 / variance, mean / variance]
  }
}
