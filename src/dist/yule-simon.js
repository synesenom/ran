import { beta } from '../special'
import Distribution from './_distribution'

/**
 * Probability mass function for the [Yule-Simon distribution]{@link https://en.wikipedia.org/wiki/Yule%E2%80%93Simon_distribution}:
 *
 * $f(k; \rho) = \rho \mathrm{B}(k, \rho + 1),$
 *
 * with $\rho > 0$ and $\mathrm{B}(x, y)$ is the beta function. Support: $k \in \mathbb{N}^+$.
 *
 * @class YuleSimon
 * @memberof ran.dist
 * @constructor
 */
export default class YuleSimon extends Distribution {
  /**
   * @param {number} rho Shape parameter.
   */
  constructor (rho) {
    super('discrete', 1)

    // Validate parameters
    this.p = { rho }
    Distribution.validate({ rho }, [
      'rho > 0'
    ])

    // Set support
    this.s = [{
      value: 1,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    this.c = {
      rhoPlus1: this.p.rho + 1
    }
  }

  static _fitInit (data) {
    // E[X] = rho/(rho-1) for rho>1; solving gives rho = mean/(mean-1).
    const mean = data.reduce((s, x) => s + x, 0) / data.length
    return [mean > 1 ? mean / (mean - 1) : 2]
  }

  _generator () {
    // Direct sampling by compounding exponential and geometric
    const e1 = -Math.log(this.r.next())
    const e2 = -Math.log(this.r.next())
    const z = Math.exp(-e2 / this.p.rho)

    // Handle z << 1 case
    return 1 - z === 1
      ? Math.ceil(e1 / z)
      : Math.ceil(-e1 / Math.log(1 - z))
  }

  _pdf (x) {
    return this.p.rho * beta(x, this.c.rhoPlus1)
  }

  _cdf (x) {
    return 1 - x * beta(x, this.c.rhoPlus1)
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    if (this.p.rho <= 1) return Infinity
    return this.p.rho / (this.p.rho - 1)
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const rho = this.p.rho
    if (rho <= 2) return Infinity
    return rho * rho / ((rho - 1) * (rho - 1) * (rho - 2))
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const rho = this.p.rho
    if (rho <= 3) return Infinity
    return (rho + 1) / (rho - 3) * Math.sqrt((rho - 2) / rho)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const rho = this.p.rho
    if (rho <= 4) return Infinity
    // Raw moments via falling factorial: E[K^(n)] = n! * rho / prod_{i=1}^{n}(rho-i)
    // Convert to ordinary moments: K^n = sum_k S(n,k)*K^(k) (Stirling 2nd kind)
    // S(2)={1,1}, S(3)={1,3,1}, S(4)={1,7,6,1}
    const f1 = rho / (rho - 1)
    const f2 = 2 * rho / ((rho - 1) * (rho - 2))
    const f3 = 6 * rho / ((rho - 1) * (rho - 2) * (rho - 3))
    const f4 = 24 * rho / ((rho - 1) * (rho - 2) * (rho - 3) * (rho - 4))
    const mu1 = f1
    const mu2 = f1 + f2
    const mu3 = f1 + 3 * f2 + f3
    const mu4 = f1 + 7 * f2 + 6 * f3 + f4
    const v = mu2 - mu1 * mu1
    const mu4c = mu4 - 4 * mu1 * mu3 + 6 * mu1 * mu1 * mu2 - 3 * mu1 * mu1 * mu1 * mu1
    return mu4c / (v * v) - 3
  }
}
