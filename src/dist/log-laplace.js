import Laplace from './laplace'

/**
 * Generator for the [log-Laplace distribution]{@link https://en.wikipedia.org/wiki/Log-Laplace_distribution}:
 *
 * $$f(x; \mu, b) = \frac{1}{2bx}e^{-\frac{|\mathrm{ln} x - \mu|}{b}},$$
 *
 * where \(\mu \in \mathbb{R}\) and \(b \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}\).
 *
 * @class LogLaplace
 * @memberOf ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} b Scale parameter. Default value is 1.
 * @constructor
 */
export default class extends Laplace {
  // Transforming Laplace distribution
  constructor (mu = 0, b = 1) {
    super(mu, b)

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
    // Direct sampling by transforming Laplace variate
    return Math.exp(super._generator())
  }

  _pdf (x) {
    return super._pdf(Math.log(x)) / x
  }

  _cdf (x) {
    return super._cdf(Math.log(x))
  }

  _q (p) {
    return Math.exp(super._q(p))
  }
}
