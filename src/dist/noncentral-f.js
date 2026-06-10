import Distribution from './_distribution'
import NoncentralBeta from './noncentral-beta'

/**
 * Probability density function for the [non-central F distribution]{@link https://en.wikipedia.org/wiki/Noncentral_F-distribution}:
 *
 * $f(x; d\_1, d\_2, \lambda) = e^{-\frac{\lambda}{2}} \sum\_{k=0}^\infty \frac{1}{k!} \bigg(\frac{\lambda}{2}\bigg)^k \frac{\Big(\frac{d_1}{d_2}\Big)^{\frac{d_1}{2} + k} \Big(\frac{d_2}{d_2 + d_1 x}\Big)^{\frac{d_1 + d_2}{2} + k}}{\mathrm{B}\Big(\frac{d_2}{2}, \frac{d_1}{2} + k\Big)} x^{\frac{d_1}{2} -1 + k},$
 *
 * where $d_1, d_2 \in \mathbb{N}^+$ and $\lambda > 0$. Support: $x \ge 0$.
 *
 * @class NoncentralF
 * @memberof ran.dist
 * @constructor
 */
export default class NoncentralF extends NoncentralBeta {
  // Transformation of non-central beta distribution
  /**
   * @param {number} d1 First degree of freedom. If not an integer, it is rounded to the nearest one.
   * @param {number} d2 Second degree of freedom. If not an integer, it is rounded to the nearest one.
   * @param {number} lambda Non-centrality parameter.
   */
  constructor (d1, d2, lambda) {
    const d1i = Math.round(d1)
    const d2i = Math.round(d2)
    super(d1i / 2, d2i / 2, lambda)

    // Validate parameters
    this.p = Object.assign(this.p, { d1: d1i, d2: d2i, lambda })
    Distribution.validate({ d1: d1i, d2: d2i, lambda }, [
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
    const x = super._generator()
    return this.p.d2 * x / (this.p.d1 * (1 - x))
  }

  _pdf (x) {
    if (x === 0) return 0
    return this.p.d1 * this.p.d2 * super._pdf(this.p.d1 * x / (this.p.d2 + this.p.d1 * x)) / Math.pow(this.p.d2 + this.p.d1 * x, 2)
  }

  _cdf (x) {
    if (x === 0) return 0
    const y = this.p.d1 * x
    return super._cdf(1 / (1 + this.p.d2 / y))
  }

  static _fitInit (data) {
    // Central F moments: E[X]=d2/(d2-2)→d2, Var[X]→d1; λ from E[NoncentralF]=d2(d1+λ)/(d1(d2-2))
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1
    const d2 = mean > 1 ? Math.max(3, Math.round(2 * mean / (mean - 1))) : 5
    const d1formula = d2 > 4
      ? Math.round(2 * d2 * d2 * (d2 - 2) / (variance * (d2 - 2) ** 2 * (d2 - 4) - 2 * d2 * d2))
      : 0
    const d1 = d1formula > 0 && isFinite(d1formula) ? Math.max(1, d1formula) : d2
    return [d1, d2, Math.max(1e-3, mean * d1 * (d2 - 2) / d2 - d1)]
  }
}
