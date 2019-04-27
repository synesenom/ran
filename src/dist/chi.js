import Chi2 from './chi2'

/**
 * Generator for the [\(\chi\) distribution]{@link https://en.wikipedia.org/wiki/Chi_distribution}:
 *
 * $$f(x; k) = \frac{1}{2^{k/2 - 1} \Gamma(k/2)} x^{k - 1} e^{-x^2/2},$$
 *
 * where \(k \in \mathbb{N}^+\). Support: \(x \in \mathbb{R}^+\).
 *
 * @class Chi
 * @memberOf ran.dist
 * @param {number=} k Degrees of freedom. If not an integer, is rounded to the nearest one. Default value is 2.
 * @constructor
 */
export default class extends Chi2 {
  // Transformation of chi2 distribution
  constructor (k = 2) {
    super(k)
    this.p = Object.assign(this.p, { k })
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]
    this.mode = Math.max(k - 2, 0)
  }

  _generator () {
    // Direct sampling by transforming chi2 variate
    return Math.sqrt(super._generator())
  }

  _pdf (x) {
    if (this.p.k === 1 && x === 0) {
      return Math.sqrt(2 / Math.PI)
    } else {
      return 2 * x * super._pdf(x * x)
    }
  }

  _cdf (x) {
    return super._cdf(x * x)
  }
}
