import NoncentralBeta from './noncentral-beta'
import Distribution from './_distribution'

/**
 * Generator for the [non-central F distribution]{@link https://en.wikipedia.org/wiki/Noncentral_F-distribution}:
 *
 * $$f(x; d_1, d_2, \lambda) = e^{-\frac{\lambda}{2}} \sum_{k=0}^\infty \frac{1}{k!} \bigg(\frac{\lambda}{2}\bigg)^k \frac{\Big(\frac{d_1}{d_2}\Big)^{\frac{d_1}{2} + k} \Big(\frac{d_2}{d_2 + d_1 x}\Big)^{\frac{d_1 + d_2}{2} + k}}{\mathrm{B}\Big(\frac{d_2}{2}, \frac{d_1}{2} + k\Big)} x^{\frac{d_1}{2} -1 + k},$$
 *
 * where \(d_1, d_2 \in \mathbb{N}^+\) and \(\lambda > 0\). Support: \(x \ge 0\).
 *
 * @class NoncentralF
 * @memberOf ran.dist
 * @param {number=} d1 First degree of freedom. If not an integer, it is rounded to the nearest one. Default value is 2.
 * @param {number=} d2 Second degree of freedom. If not an integer, it is rounded to the nearest one. Default value is 2.
 * @param {number=} lambda Non-centrality parameter. Default value is 1.
 * @constructor
 */
export default class extends NoncentralBeta {
  // Transformation of non-central beta distribution
  constructor (d1 = 2, d2 = 2, lambda = 1) {
    let d1i = Math.round(d1)
    let d2i = Math.round(d2)
    super(d1i / 2, d2i / 2, lambda)

    // Validate parameters
    this.p = Object.assign(this.p, { d1: d1i, d2: d2i, lambda })
    Distribution._validate({ d1: d1i, d2: d2i, lambda }, [
      'd1 > 0',
      'd2 > 0',
      'lambda > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling by transforming non-central beta variate
    let x = super._generator()
    return this.p.d2 * x / (this.p.d1 * (1 - x))
  }

  _pdf (x) {
    return this.p.d1 * this.p.d2 * super._pdf(this.p.d1 * x / (this.p.d2 + this.p.d1 * x)) / Math.pow(this.p.d2 + this.p.d1 * x, 2)
  }

  _cdf (x) {
    let y = this.p.d1 * x
    return super._cdf( 1 / (1 + this.p.d2 / y))
  }
}
