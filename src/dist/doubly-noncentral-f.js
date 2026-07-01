import DoublyNoncentralBeta from './doubly-noncentral-beta'

/**
 * Probability density function for the [doubly non-central F distribution]{@link https://doi.org/10.1111/j.1467-842X.1965.tb00036.x}:
 *
 * $f(x; d_1, d_2, \lambda_1, \lambda_2) = \frac{d_1}{d_2} e^{-\frac{\lambda_1 + \lambda_2}{2}} \sum\_{k = 0}^\infty \sum\_{l = 0}^\infty \frac{\big(\frac{\lambda_1}{2}\big)^k}{k!} \frac{\big(\frac{\lambda_2}{2}\big)^l}{l!} \frac{\big(\frac{d_1 x}{d_2}\big)^{\frac{d_1}{2} + k - 1}}{\big(1 + \frac{d_1 x}{d_2}\big)^{\frac{d_1 + d_2}{2} + k + l}} \frac{1}{\mathrm{B}\big(\frac{d_1}{2} + k, \frac{d_2}{2} + l\big)},$
 *
 * where $d_1, d_2 \in \mathbb{N}^+$ and $\lambda_1, \lambda_2 \ge 0$. Support: $x > 0$.
 * Formula from M. L. Tiku. Series expansions for the doubly non-central F-distribution. *Australian Journal of Statistics*, 7(2):78–89, 1965.
 *
 * @class DoublyNoncentralF
 * @memberof ran.dist
 * @constructor
 */
export default class DoublyNoncentralF extends DoublyNoncentralBeta {
  // Transformation of double non-central beta
  /**
   * @param {number} d1 First degrees of freedom. If not an integer, it is rounded to the nearest one.
   * @param {number} d2 Second degrees of freedom. If not an integer, it is rounded to the nearest one.
   * @param {number} lambda1 First non-centrality parameter.
   * @param {number} lambda2 Second non-centrality parameter.
   */
  constructor (d1, d2, lambda1, lambda2) {
    super(d1 / 2, d2 / 2, lambda1, lambda2)

    // Validate parameters
    const d1i = Math.round(d1)
    const d2i = Math.round(d2)
    this.p = Object.assign(this.p, { d1: d1i, d2: d2i })

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
    // Direct sampling by transforming a doubly non-central beta
    const x = super._generator()
    return this.p.d2 * x / (this.p.d1 * (1 - x))
  }

  _pdf (x) {
    const n = this.p.d1 / this.p.d2
    return n * super._pdf(x / (1 / n + x)) / Math.pow(1 + n * x, 2)
  }

  _cdf (x) {
    return super._cdf(x / (this.p.d2 / this.p.d1 + x))
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    return this.p.d2 > 6 ? super.skewness() : Infinity
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    return this.p.d2 > 8 ? super.kurtosis() : Infinity
  }

  static _fitInit (data) {
    // Central F moment matching for d1, d2; total λ split symmetrically between λ1 and λ2
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1
    const d2 = mean > 1 ? Math.max(3, Math.round(2 * mean / (mean - 1))) : 5
    const d1formula = d2 > 4
      ? Math.round(2 * d2 * d2 * (d2 - 2) / (variance * (d2 - 2) ** 2 * (d2 - 4) - 2 * d2 * d2))
      : 0
    const d1 = d1formula > 0 && isFinite(d1formula) ? Math.max(1, d1formula) : d2
    const lambda = Math.max(1e-3, mean * d1 * (d2 - 2) / d2 - d1) / 2
    return [d1, d2, lambda, lambda]
  }
}
