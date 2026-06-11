import { erfc } from '../special'
import Distribution from './_distribution'

/**
 * Probability density function for the [Benini distribution]{@link https://en.wikipedia.org/wiki/Benini_distribution}:
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

  // E[X^r] = sigma^r * (r * sqrt(pi/beta)/2 * exp(u^2) * erfc(-u) + 1), u = (r-alpha)/(2*sqrt(beta))
  // Derived by substituting y=log(x/sigma) and completing the square in the resulting Gaussian integral.
  _rawMoment (r) {
    const { alpha, beta: b, sigma } = this.p
    const u = (r - alpha) / (2 * Math.sqrt(b))
    return Math.pow(sigma, r) * (r * Math.sqrt(Math.PI / b) / 2 * Math.exp(u * u) * erfc(-u) + 1)
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return this._rawMoment(1)
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const m1 = this._rawMoment(1)
    const m2 = this._rawMoment(2)
    return m2 - m1 * m1
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const m1 = this._rawMoment(1)
    const m2 = this._rawMoment(2)
    const m3 = this._rawMoment(3)
    const mu2 = m2 - m1 * m1
    const mu3 = m3 - 3 * m2 * m1 + 2 * m1 * m1 * m1
    return mu3 / Math.pow(mu2, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const m1 = this._rawMoment(1)
    const m2 = this._rawMoment(2)
    const m3 = this._rawMoment(3)
    const m4 = this._rawMoment(4)
    const mu2 = m2 - m1 * m1
    const mu4 = m4 - 4 * m3 * m1 + 6 * m2 * m1 * m1 - 3 * m1 * m1 * m1 * m1
    return mu4 / (mu2 * mu2) - 3
  }

  static _fitInit (data) {
    // sigma ≈ min(data) seeds scale; Hill estimator on log-excesses assumes near-Pareto tail (beta → 0)
    const sigma = Math.min(...data) * 0.99
    const n = data.length
    const meanLogExcess = Math.max(data.reduce((s, x) => s + Math.log(x / sigma), 0) / n, 1e-9)
    return [1 / meanLogExcess, 1, sigma]
  }
}
