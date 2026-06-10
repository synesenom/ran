import Normal from './normal'
import Distribution from './_distribution'
import { erfinv } from '../special'

/**
 * Probability density function for the [truncated normal distribution]{@link https://en.wikipedia.org/wiki/Truncated_normal_distribution}:
 *
 * $f(x; \mu, \sigma, a, b) = \frac{\phi(\xi)}{\Phi(\beta) - \Phi(\alpha)},$
 *
 * where $\xi = \frac{x - \mu}{\sigma}, \alpha = \frac{a - \mu}{\sigma}$ and $\beta = \frac{b - \mu}{\sigma}$.
 * The functions $\phi$ and $\Phi$ denote the probability density and cumulative distribution functions of the normal
 * distribution. Finally, $\mu \in \mathbb{R}$, $\sigma > 0$ and $b > a$. Support: $x \in [a, b]$.
 *
 * Cumulative distribution function:
 *
 * $F(x; \mu, \sigma, a, b) = \frac{\Phi\left(\frac{x-\mu}{\sigma}\right) - \Phi\left(\frac{a-\mu}{\sigma}\right)}{\Phi\left(\frac{b-\mu}{\sigma}\right) - \Phi\left(\frac{a-\mu}{\sigma}\right)}$
 *
 * @class TruncatedNormal
 * @memberof ran.dist
 * @constructor
 */
export default class TruncatedNormal extends Normal {
  /**
   * @param {number} mu Mean of the underlying normal distribution.
   * @param {number} sigma Variance of the underlying normal distribution.
   * @param {number} a Lower boundary of the support.
   * @param {number} b Upper boundary of the support.
   */
  constructor (mu, sigma, a, b) {
    // Call super and update number of parameters.
    super(mu, sigma)
    this.k = 4

    // Validate parameters.
    this.p = { mu, sigma, a, b }
    Distribution.validate({ mu, sigma, a, b }, [
      'sigma > 0',
      'b > a'
    ])

    // Set support.
    this.s = [{
      value: a,
      closed: true
    }, {
      value: b,
      closed: true
    }]

    // Speed-up constants — merge with parent Normal constants.
    const stdA = (a - mu) / sigma
    const stdB = (b - mu) / sigma
    Object.assign(this.c, {
      phiA: super._cdf(a),
      Z: super._cdf(b) - super._cdf(a),
      stdA,
      stdB,
      fStdA: Math.exp(-0.5 * stdA * stdA) / Math.sqrt(2 * Math.PI),
      fStdB: Math.exp(-0.5 * stdB * stdB) / Math.sqrt(2 * Math.PI)
    })
  }

  /**
   * @returns {number} Mean of the distribution.
   */
  mean () {
    return this.p.mu + this.p.sigma * (this.c.fStdA - this.c.fStdB) / this.c.Z
  }

  /**
   * @returns {number} Variance of the distribution.
   */
  variance () {
    const mu1 = (this.c.fStdA - this.c.fStdB) / this.c.Z
    return this.p.sigma ** 2 * (1 + (this.c.stdA * this.c.fStdA - this.c.stdB * this.c.fStdB) / this.c.Z - mu1 * mu1)
  }

  /**
   * @returns {number} Skewness of the distribution.
   */
  skewness () {
    const { fStdA, fStdB, stdA, stdB, Z } = this.c
    const mu1 = (fStdA - fStdB) / Z
    const mu2 = 1 + (stdA * fStdA - stdB * fStdB) / Z
    const mu3 = 2 * mu1 + (stdA * stdA * fStdA - stdB * stdB * fStdB) / Z
    const v = mu2 - mu1 * mu1
    return (mu3 - 3 * mu1 * mu2 + 2 * mu1 ** 3) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} Excess kurtosis of the distribution.
   */
  kurtosis () {
    const { fStdA, fStdB, stdA, stdB, Z } = this.c
    const mu1 = (fStdA - fStdB) / Z
    const mu2 = 1 + (stdA * fStdA - stdB * fStdB) / Z
    const mu3 = 2 * mu1 + (stdA * stdA * fStdA - stdB * stdB * fStdB) / Z
    const mu4 = 3 * mu2 + (stdA ** 3 * fStdA - stdB ** 3 * fStdB) / Z
    const v = mu2 - mu1 * mu1
    return (mu4 - 4 * mu1 * mu3 + 6 * mu1 * mu1 * mu2 - 3 * mu1 ** 4) / (v * v) - 3
  }

  static _fitInit (data) {
    // Method of moments: use observed min/max as bounds, sample mean and std as location/scale
    const n = data.length
    const a = Math.min(...data)
    const b = Math.max(...data)
    const mu = data.reduce((s, x) => s + x, 0) / n
    const sigma = Math.sqrt(data.reduce((s, x) => s + (x - mu) ** 2, 0) / n) || 1
    return [mu, sigma, a, b > a ? b : a + 1]
  }

  _generator () {
    return this._q(this.r.next())
  }

  _pdf (x) {
    return super._pdf(x) / this.c.Z
  }

  _cdf (x) {
    return (super._cdf(x) - this.c.phiA) / this.c.Z
  }

  _q (p) {
    return this.p.mu + this.c.sigmaRoot2 * erfinv(2 * (this.c.phiA + p * this.c.Z) - 1)
  }
}
