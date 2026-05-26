import Distribution from './_distribution'

/**
 * Generator for the [half-logistic distribution]{@link https://en.wikipedia.org/wiki/Half-logistic_distribution}:
 *
 * $$f(x) = \frac{2 e^{-x}}{(1 + e^{-x})^2}.$$
 *
 * Support: $x \in [0, \infty)$.
 *
 * @class HalfLogistic
 * @memberof ran.dist
 * @constructor
 */
export default class HalfLogistic extends Distribution {
  /** */
  constructor () {
    super('continuous', 0)

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
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const y = Math.exp(-x)
    return 2 * y / Math.pow(1 + y, 2)
  }

  _cdf (x) {
    // tanh(x/2) = (1-exp(-x))/(1+exp(-x)) avoids cancellation near x=0
    return Math.tanh(x / 2)
  }

  _q (p) {
    return -Math.log((1 - p) / (1 + p))
  }
}
