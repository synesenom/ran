import Distribution from './_distribution'

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
export default class extends Distribution {
  constructor (mu = 0, b = 1) {
    super('continuous', arguments.length)
    this.p = { mu, b }
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling from Laplace
    return Math.exp(this.p.b * Math.log(Math.random() / Math.random()) + this.p.mu)
  }

  _pdf (x) {
    return Math.exp(-Math.abs(Math.log(x) - this.p.mu) / this.p.b) / (2 * x * this.p.b)
  }

  _cdf (x) {
    return 0.5 * (1 + Math.sign(Math.log(x) - this.p.mu) * (1 - Math.exp(-Math.abs(Math.log(x) - this.p.mu) / this.p.b)))
  }
}
