import DoublyNoncentralBeta from './doubly-noncentral-beta'

/**
 * Generator for the [doubly non-central F distribution]{@link https://rdrr.io/cran/sadists/f/inst/doc/sadists.pdf}:
 *
 * $$f(x; d_1, d_2, \lambda_1, \lambda_2) = \frac{d_1}{d_2} e^{-\frac{\lambda_1 + \lambda_2}{2}} \sum_{k = 0}^\infty \sum_{l = 0}^\infty \frac{\big(\frac{\lambda_1}{2}\big)^k}{k!} \frac{\big(\frac{\lambda_2}{2}\big)^l}{l!} \frac{\big(\frac{d_1 x}{d_2}\big)^{\frac{d_1}{2} + k - 1}}{\big(1 + \frac{d_1 x}{d_2}\big)^{\frac{d_1 + d_2}{2} + k + l}} \frac{1}{\mathrm{B}\big(\frac{d_1}{2} + k, \frac{d_2}{2} + l\big)},$$
 *
 * where \(d_1, d_2 \in \mathbb{N}^+\) and \(\lambda_1, \lambda_2 \ge 0\). Support: \(x > 0\).
 *
 * @class DoublyNoncentralF
 * @memberof ran.dist
 * @param {number=} d1 First degrees of freedom. If not an integer, it is rounded to the nearest one. Default value is 2.
 * @param {number=} d2 Second degrees of freedom. If not an integer, it is rounded to the nearest one. Default value is 2.
 * @param {number=} lambda1 First non-centrality parameter. Default value is 1.
 * @param {number=} lambda2 Second non-centrality parameter. Default value is 1.
 * @constructor
 */
export default class extends DoublyNoncentralBeta {
  // Transformation of double non-central beta
  constructor (d1 = 2, d2 = 2, lambda1 = 1, lambda2 = 1) {
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
}
