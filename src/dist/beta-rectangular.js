import Beta from './beta'
import Distribution from './_distribution'

/**
 * Probability density function for the [beta-rectangular distribution]{@link https://en.wikipedia.org/wiki/Beta_rectangular_distribution}:
 *
 * $f(x; \alpha, \beta, \theta, a, b) = \theta \frac{(x - a)^{\alpha - 1} (b - x)^{\beta - 1}}{\mathrm{B}(\alpha, \beta) (b - a)^{\alpha + \beta - 1}} + \frac{1 - \theta}{b - a},$
 *
 * with $\alpha, \beta > 0$, $\theta \in \[0, 1\]$, $a, b \in \mathbb{R}$, $a < b$ and $\mathrm{B}(x, y)$ is the beta function. Support: $x \in \[a, b\]$.
 *
 * @class BetaRectangular
 * @memberof ran.dist
 * @constructor
 */
export default class BetaRectangular extends Beta {
  /**
   * @param {number} alpha First shape parameter.
   * @param {number} beta Second shape parameter.
   * @param {number} theta Mixture parameter.
   * @param {number} a Lower boundary of the support.
   * @param {number} b Upper boundary of the support.
   */
  constructor (alpha, beta, theta, a, b) {
    super(alpha, beta)

    // BetaRectangular has 5 free parameters (alpha, beta, theta, a, b); override the 2 inherited from Beta
    // solutions/distribution/2026-06-07-2138-continuous-subclass-natural-params.md
    // solutions/correctness/2026-07-20-2359-beta-rectangular-inherited-k-bic-bias.md
    this.k = 5

    // Validate parameters
    this.p = Object.assign(this.p, { theta, a, b })
    Distribution.validate({ theta, a, b }, [
      'theta >= 0', 'theta <= 1',
      'a < b'
    ])

    // Set support
    this.s = [{
      value: a,
      closed: true
    }, {
      value: b,
      closed: true
    }]

    // Speed-up constants
    Object.assign(this.c, {
      bMinusA: b - a,
      oneMinusTheta: 1 - theta
    })
  }

  _generator () {
    // Direct sampling by mixing beta and uniform variates
    return this.r.next() < this.p.theta
      ? super._generator() * this.c.bMinusA + this.p.a
      : this.r.next() * this.c.bMinusA + this.p.a
  }

  _pdf (x) {
    return (this.p.theta * super._pdf((x - this.p.a) / this.c.bMinusA) + this.c.oneMinusTheta) / this.c.bMinusA
  }

  _cdf (x) {
    const y = x - this.p.a
    return this.p.theta * super._cdf(y / this.c.bMinusA) + this.c.oneMinusTheta * y / this.c.bMinusA
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    const { alpha, beta, theta, a, b } = this.p
    const muBeta = a + (b - a) * alpha / (alpha + beta)
    return theta * muBeta + (1 - theta) * (a + b) / 2
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const { alpha, beta, theta, a, b } = this.p
    const s = alpha + beta
    const w = b - a
    const muBeta = a + w * alpha / s
    const varBeta = w * w * alpha * beta / (s * s * (s + 1))
    const d = muBeta - (a + b) / 2
    return theta * varBeta + (1 - theta) * w * w / 12 + theta * (1 - theta) * d * d
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const { alpha, beta, theta, a, b } = this.p
    const s = alpha + beta
    const w = b - a
    const muBeta = a + w * alpha / s
    const muUnif = (a + b) / 2
    const varBeta = w * w * alpha * beta / (s * s * (s + 1))
    const varUnif = w * w / 12
    const d = muBeta - muUnif
    const v = theta * varBeta + (1 - theta) * varUnif + theta * (1 - theta) * d * d
    const skewBeta = 2 * (beta - alpha) * Math.sqrt(s + 1) / ((s + 2) * Math.sqrt(alpha * beta))
    const mu3Beta = skewBeta * Math.pow(varBeta, 1.5)
    const dB = (1 - theta) * d
    const dU = -theta * d
    const mu3 = theta * (mu3Beta + 3 * varBeta * dB + dB ** 3) +
      (1 - theta) * (3 * varUnif * dU + dU ** 3)
    return mu3 / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const { alpha, beta, theta, a, b } = this.p
    const s = alpha + beta
    const w = b - a
    const muBeta = a + w * alpha / s
    const muUnif = (a + b) / 2
    const varBeta = w * w * alpha * beta / (s * s * (s + 1))
    const varUnif = w * w / 12
    const d = muBeta - muUnif
    const v = theta * varBeta + (1 - theta) * varUnif + theta * (1 - theta) * d * d
    const skewBeta = 2 * (beta - alpha) * Math.sqrt(s + 1) / ((s + 2) * Math.sqrt(alpha * beta))
    const kurtBeta = 6 * ((alpha - beta) ** 2 * (s + 1) - alpha * beta * (s + 2)) /
      (alpha * beta * (s + 2) * (s + 3))
    const mu3Beta = skewBeta * Math.pow(varBeta, 1.5)
    const mu4Beta = (kurtBeta + 3) * varBeta * varBeta
    const dB = (1 - theta) * d
    const dU = -theta * d
    const mu4 = theta * (mu4Beta + 4 * mu3Beta * dB + 6 * varBeta * dB * dB + dB ** 4) +
      (1 - theta) * (w ** 4 / 80 + 6 * varUnif * dU * dU + dU ** 4)
    return mu4 / (v * v) - 3
  }

  static _fitInit (data) {
    // Endpoints from sample extremes; neutral shape params (2,2) and theta=0.5 avoid degenerate beta boundary
    const lo = Math.min(...data)
    const hi = Math.max(...data)
    const eps = (hi - lo) * 0.01 || 1e-6
    return [2, 2, 0.5, lo - eps, hi + eps]
  }
}
