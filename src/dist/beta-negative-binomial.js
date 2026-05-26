import { logBeta } from '../special'
import PreComputed from './_pre-computed'
import Distribution from './_distribution'
import rBeta from './_beta'
import gamma from './_gamma'
import poisson from './_poisson'

/**
 * Generator for the [beta-negative-binomial distribution]{@link https://en.wikipedia.org/wiki/Beta_negative_binomial_distribution}:
 *
 * $f(k; r, \alpha, \beta) = \frac{\Gamma(r + k)}{\Gamma(k + 1)\,\Gamma(r)} \frac{\mathrm{B}(\alpha + r,\, \beta + k)}{\mathrm{B}(\alpha,\, \beta)},$
 *
 * with $r \in \mathbb{N}^+$ and $\alpha, \beta > 0$. Support: $k \in \mathbb{N}_0$.
 *
 * @class BetaNegativeBinomial
 * @memberof ran.dist
 * @constructor
 */
export default class BetaNegativeBinomial extends PreComputed {
  /**
   * @param {number} r Number of successes (rounded to nearest integer).
   * @param {number} alpha First shape parameter.
   * @param {number} beta Second shape parameter.
   */
  constructor (r, alpha, beta) {
    super()
    this.k = 3

    // Validate parameters
    const ri = Math.round(r)
    this.p = { r: ri, alpha, beta }
    Distribution.validate({ r: ri, alpha, beta }, [
      'r > 0',
      'alpha > 0',
      'beta > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // TODO Speed-up constants
  }

  _pk (k) {
    if (k === 0) {
      // return Math.exp(logGamma(this.p.r + k) - logGamma(k + 1) - logGamma(this.p.r) + logBeta(this.p.alpha + this.p.r, this.p.beta + k) - logBeta(this.p.alpha, this.p.beta))
      return Math.exp(logBeta(this.p.alpha + this.p.r, this.p.beta) - logBeta(this.p.alpha, this.p.beta))
    }

    return this.pdfTable[k - 1] * (this.p.r + k - 1) * (this.p.beta + k - 1) / (k * (this.p.alpha + this.p.r + this.p.beta + k - 1))
    // return this.pdfTable[k - 1] * (k + this.p.r - 1) * (k + (this.p.alpha - 1)) / (k * (k + this.p.alpha + this.p.beta + this.p.r - 1))
    // return Math.exp(logGamma(this.p.r + k) - logGamma(k + 1) - logGamma(this.p.r) + logBeta(this.p.alpha + this.p.r, this.p.beta + k) - logBeta(this.p.alpha, this.p.beta))
  }

  // TODO Direct sampling
  _generator () {
    // Direct sampling by compounding beta and negative binomial
    const p = rBeta(this.r, this.p.alpha, this.p.beta)
    return poisson(this.r, gamma(this.r, this.p.r, 1 / p - 1))
  }
}
