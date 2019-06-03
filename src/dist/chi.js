import Distribution from './_distribution'
import Chi2 from './chi2'

/**
 * Generator for the [\(\chi\) distribution]{@link https://en.wikipedia.org/wiki/Chi_distribution}:
 *
 * $$f(x; k) = \frac{1}{2^{k/2 - 1} \Gamma(k/2)} x^{k - 1} e^{-x^2/2},$$
 *
 * where \(k \in \mathbb{N}^+\). Support: \(x > 0\).
 *
 * @class Chi
 * @memberOf ran.dist
 * @param {number=} k Degrees of freedom. If not an integer, is rounded to the nearest integer. Default value is 2.
 * @constructor
 */
export default class extends Chi2 {
  // Transformation of chi2 distribution
  constructor (k = 2) {
    super(k)

    // Validate parameters
    let ki = Math.round(k)
    this.p = Object.assign(this.p, { k: ki })
    Distribution._validate({ k: ki }, [
      'k > 0'
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
