import Distribution from './_distribution'

/**
 * Generator for the [Benini distribution]{@link https://en.wikipedia.org/wiki/Benini_distribution}:
 *
 * $$f(x; \alpha, \beta, \sigma) = \bigg(\frac{\alpha}{x} + \frac{2 \beta \ln \frac{x}{\sigma}}{x}\bigg) e^{-\alpha \ln \frac{x}{\sigma} - \beta \ln^2 \frac{x}{\sigma}},$$
 *
 * with \(\alpha, \beta, \sigma \in \mathbb{R}^+\). Support: \(x \in (\sigma, \infty)\).
 *
 * @class Benini
 * @memberOf ran.dist
 * @param {number=} alpha First shape parameter. Default value is 1.
 * @param {number=} beta Second shape parameter. Default value is 1.
 * @param {number=} sigma Scale parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (alpha = 1, beta = 1, sigma = 1) {
    super('continuous', arguments.length)
    this.p = { alpha, beta, sigma }
    this.s = [{
      value: sigma,
      closed: true
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    let D = -1
    while (D < 0) {
      D = this.p.alpha * this.p.alpha - 4 * this.p.beta * Math.log(Math.random())
    }
    return this.p.sigma * Math.exp(0.5 * (Math.sqrt(D) - this.p.alpha) / this.p.beta)
  }

  _pdf (x) {
    let y = Math.log(x / this.p.sigma)
    return Math.exp(-this.p.alpha * y - this.p.beta * y * y) * (this.p.alpha / x + 2 * this.p.beta * y / x)
  }

  _cdf (x) {
    let y = Math.log(x / this.p.sigma)
    return 1 - Math.exp(-this.p.alpha * y - this.p.beta * y * y)
  }
}
