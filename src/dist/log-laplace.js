import Laplace from './laplace'

/**
 * Probability density function for the [log-Laplace distribution]{@link https://en.wikipedia.org/wiki/Log-Laplace_distribution}:
 *
 * $f(x; \mu, b) = \frac{1}{2bx}e^{-\frac{|\mathrm{ln} x - \mu|}{b}},$
 *
 * where $\mu \in \mathbb{R}$ and $b > 0$. Support: $x > 0$.
 *
 * @class LogLaplace
 * @memberof ran.dist
 * @constructor
 */
export default class LogLaplace extends Laplace {
  // Transforming Laplace distribution
  /**
   * @param {number} mu Location parameter.
   * @param {number} b Scale parameter.
   */
  constructor (mu, b) {
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
    return p < 0.5
      ? Math.exp(this.p.mu + this.p.b * Math.log(2 * p))
      : Math.exp(this.p.mu - this.p.b * Math.log(2 - 2 * p))
  }
}
