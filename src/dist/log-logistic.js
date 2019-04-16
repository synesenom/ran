import Logistic from './logistic'

/**
 * Generator for the [log-logistic distribution]{@link https://en.wikipedia.org/wiki/Log-logistic_distribution} (also known as Fisk distribution):
 *
 * $$f(x; \alpha, \beta) = \frac{(\beta / \alpha) (x / \alpha)^{\beta - 1}}{([1 + (x / \alpha)^\beta]^2},$$
 *
 * with \(\alpha, \beta \in \mathbb{R}^+\). Support: \(x \in [0, \infty)\).
 *
 * @class LogLogistic
 * @memberOf ran.dist
 * @param {number=} alpha Scale parameter. Default value is 1.
 * @param {number=} beta Shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Logistic {
  constructor (alpha = 1, beta = 1) {
    super(Math.log(alpha), 1 / beta)
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
    this.mode = beta > 1 ? alpha * Math.pow((beta - 1) / (beta + 1), 1 / beta) : 0
  }

  _generator () {
    // Direct sampling by transforming logistic variate
    return Math.exp(super._generator())
  }

  _pdf (x) {
    return super._pdf(Math.log(x)) / x
  }

  _cdf (x) {
    return super._cdf(Math.log(x))
  }
}
