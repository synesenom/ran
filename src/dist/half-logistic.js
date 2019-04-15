import Logistic from './logistic'

/**
 * Generator for the [half-logistic distribution]{@link https://en.wikipedia.org/wiki/Half-logistic_distribution}:
 *
 * $$f(x) = \frac{2 e^{-x}}{(1 + e^{-x})^2)}.$$
 *
 * Support: \(x \in [0, \infty)\).
 *
 * @class HalfLogistic
 * @memberOf ran.dist
 * @constructor
 */
export default class extends Logistic {
  // Transformation of logistic distribution
  constructor () {
    super(0, 1)
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling by transforming logistic variate
    return Math.abs(super._generator())
  }

  _pdf (x) {
    return 2 * super._pdf(x)
  }

  _cdf (x) {
    return 2 * super._cdf(x) - 1
  }
}
