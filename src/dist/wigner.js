import gamma from './_gamma'
import Distribution from './_distribution'

/**
 * Generator for [Wigner distribution]{@link https://en.wikipedia.org/wiki/Wigner_semicircle_distribution} (also known
 * as semicircle distribution):
 *
 * $f(x; R) = \frac{2}{\pi R^2} \sqrt{R^2 - x^2},$
 *
 * with $R > 0$. Support: $x \in \[-R, R\]$.
 *
 * @class Wigner
 * @memberof ran.dist
 * @constructor
 */
export default class Wigner extends Distribution {
  /**
   * @param {number} R Radius of the distribution.
   */
  constructor (R) {
    super('continuous', 1)

    // Validate parameters
    this.p = { R }
    Distribution.validate({ R }, [
      'R > 0'
    ])

    // Set support
    this.s = [{
      value: -R,
      closed: true
    }, {
      value: R,
      closed: true
    }]
  }

  static _fitInit (data) {
    // Wigner Var[X] = R²/4 ⟹ R = 2·std; also enforce R ≥ max|x| to cover observed support
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1
    const rStd = 2 * Math.sqrt(variance)
    const maxAbs = Math.max(...data.map(x => Math.abs(x)))
    return [Math.max(rStd, maxAbs)]
  }

  _generator () {
    // Direct sampling by transforming beta variate
    const x = gamma(this.r, 1.5, 1)
    const y = gamma(this.r, 1.5, 1)
    return 2 * this.p.R * x / (x + y) - this.p.R
  }

  _pdf (x) {
    const r = this.p.R * this.p.R
    return 2 * Math.sqrt(r - x * x) / (Math.PI * r)
  }

  _cdf (x) {
    const r = this.p.R * this.p.R
    return 0.5 + x * Math.sqrt(r - x * x) / (Math.PI * r) + Math.asin(x / this.p.R) / Math.PI
  }

  /**
   * @returns {number} The mean of the distribution (zero by symmetry).
   */
  mean () {
    return 0
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    return this.p.R * this.p.R / 4
  }

  /**
   * @returns {number} The skewness of the distribution (zero by symmetry).
   */
  skewness () {
    return 0
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    return -1
  }
}
