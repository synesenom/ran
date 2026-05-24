import Distribution from './_distribution'

/**
 * Generator for the [Benini distribution]{@link https://en.wikipedia.org/wiki/Benini_distribution}:
 *
 * $f(x; \alpha, \beta, \sigma) = \bigg(\frac{\alpha}{x} + \frac{2 \beta \ln \frac{x}{\sigma}}{x}\bigg) e^{-\alpha \ln \frac{x}{\sigma} - \beta \ln^2 \frac{x}{\sigma}},$
 *
 * with $\alpha, \beta, \sigma > 0$. Support: $x \in (\sigma, \infty)$.
 *
 * @class Benini
 * @memberof ran.dist
 * @constructor
 */
export default class Benini extends Distribution {
  /**
   * @param {number} alpha First shape parameter.
   * @param {number} beta Second shape parameter.
   * @param {number} sigma Scale parameter.
   */
  constructor (alpha, beta, sigma) {
    super('continuous', 3)

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
    this.c = {
      alpha2: alpha * alpha,
      fourBeta: 4 * beta,
      halfInvBeta: 0.5 / beta
    }
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
    // -expm1 avoids catastrophic cancellation when y = log(x/sigma) is near 0 (x near sigma)
    return -Math.expm1(-y * (this.p.alpha + this.p.beta * y))
  }

  _q (p) {
    return this.p.sigma * Math.exp(this.c.halfInvBeta * (Math.sqrt(this.c.alpha2 - this.c.fourBeta * Math.log(1 - p)) - this.p.alpha))
  }
}
