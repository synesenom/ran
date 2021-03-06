import Distribution from './_distribution'

/**
 * Generator for the [Benini distribution]{@link https://en.wikipedia.org/wiki/Benini_distribution}:
 *
 * $$f(x; \alpha, \beta, \sigma) = \bigg(\frac{\alpha}{x} + \frac{2 \beta \ln \frac{x}{\sigma}}{x}\bigg) e^{-\alpha \ln \frac{x}{\sigma} - \beta \ln^2 \frac{x}{\sigma}},$$
 *
 * with $\alpha, \beta, \sigma > 0$. Support: $x \in (\sigma, \infty)$.
 *
 * @class Benini
 * @memberof ran.dist
 * @param {number=} alpha First shape parameter. Default value is 1.
 * @param {number=} beta Second shape parameter. Default value is 1.
 * @param {number=} sigma Scale parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (alpha = 1, beta = 1, sigma = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { alpha, beta, sigma }
    Distribution.validate({ alpha, beta, sigma }, [
      'alpha > 0',
      'beta > 0',
      'sigma > 0'
    ])

    // Set support
    this.s = [{
      value: sigma,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    this.c = [
      alpha * alpha,
      4 * beta,
      0.5 / beta
    ]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const y = Math.log(x / this.p.sigma)
    const z = this.p.alpha + this.p.beta * y
    return Math.exp(-y * z) * (z + this.p.beta * y) / x
  }

  _cdf (x) {
    const y = Math.log(x / this.p.sigma)
    return 1 - Math.exp(-y * (this.p.alpha + this.p.beta * y))
  }

  _q (p) {
    return this.p.sigma * Math.exp(this.c[2] * (Math.sqrt(this.c[0] - this.c[1] * Math.log(1 - p)) - this.p.alpha))
  }
}
