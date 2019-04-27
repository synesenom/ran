import Distribution from './_distribution'

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
export default class extends Distribution {
  constructor () {
    super('continuous', arguments.length)
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    let y = Math.exp(-x)
    return 2 * y / Math.pow(1 + y, 2)
  }

  _cdf (x) {
    let y = Math.exp(-x)
    return (1 - y) / (1 + y)
  }

  _q (p) {
    return -Math.log((1 - p) / (1 + p))
  }
}
