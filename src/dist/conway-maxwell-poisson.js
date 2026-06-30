import Distribution from './_distribution'
import PreComputed from './_pre-computed'

/**
 * Probability mass function for the [Conway-Maxwell-Poisson distribution]{@link https://en.wikipedia.org/wiki/Conway%E2%80%93Maxwell%E2%80%93Poisson_distribution}:
 *
 * $f(k; \lambda, \nu) = \frac{\lambda^k}{(k!)^\nu Z(\lambda, \nu)},$
 *
 * where $\lambda > 0$, $\nu > 0$, and $Z(\lambda, \nu) = \sum_{j=0}^\infty \frac{\lambda^j}{(j!)^\nu}$.
 * Support: $k \in \mathbb{N}_0$.
 *
 * @class ConwayMaxwellPoisson
 * @memberof ran.dist
 * @constructor
 */
export default class ConwayMaxwellPoisson extends PreComputed {
  /**
   * @param {number} lambda Rate parameter (lambda > 0).
   * @param {number} nu Dispersion parameter (nu > 0). nu = 1 gives Poisson, nu > 1 gives underdispersion.
   */
  constructor (lambda, nu) {
    // logP=true: _pk returns log-probabilities; PreComputed.advance exponentiates before CDF accumulation
    super(true)
    this.k = 2

    this.p = { lambda, nu }
    Distribution.validate({ lambda, nu }, [
      'lambda > 0',
      'nu > 0'
    ])

    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // Compute log(Z) via log-space recurrence and running log-sum-exp.
    // Direct accumulation overflows to Infinity for lambda >= ~710 (term ~ lambda^j/j! peaks
    // near j=lambda, exceeding Number.MAX_VALUE); log-space avoids this entirely.
    const logLambda = Math.log(lambda)
    const LOG_TOL = Math.log(1e-14)
    let logTerm = 0
    let logZ = 0
    let j = 0
    do {
      j++
      logTerm += logLambda - nu * Math.log(j)
      const m = Math.max(logZ, logTerm)
      logZ = m + Math.log(Math.exp(logZ - m) + Math.exp(logTerm - m))
    } while (logTerm > logZ + LOG_TOL)

    Object.assign(this.c, {
      logP0: -logZ
    })
  }

  static _fitInit (data) {
    // Var[X] ≈ lambda/nu; E[X] ≈ lambda. Ratio mean/variance seeds the dispersion nu.
    const mean = data.reduce((s, x) => s + x, 0) / data.length
    const variance = data.reduce((s, x) => s + x * x, 0) / data.length - mean * mean
    return [Math.max(0.01, mean), Math.max(0.01, mean / Math.max(variance, 0.01))]
  }

  _pk (k) {
    if (k === 0) {
      return this.c.logP0
    }
    return this.pdfTable[k - 1] + Math.log(this.p.lambda) - this.p.nu * Math.log(k)
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    const { lambda, nu } = this.p
    const logLambda = Math.log(lambda)
    const LOG_TOL = Math.log(1e-14)
    const mode = Math.pow(lambda, 1 / nu)
    let sum = 0
    let logTerm = 0
    let k = 0
    do {
      k++
      logTerm += logLambda - nu * Math.log(k)
      sum += k * Math.exp(logTerm + this.c.logP0)
    } while (k < mode || logTerm + this.c.logP0 > LOG_TOL)
    return sum
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const { lambda, nu } = this.p
    const logLambda = Math.log(lambda)
    const LOG_TOL = Math.log(1e-14)
    const mode = Math.pow(lambda, 1 / nu)
    let e1 = 0
    let e2 = 0
    let logTerm = 0
    let k = 0
    do {
      k++
      logTerm += logLambda - nu * Math.log(k)
      const p = Math.exp(logTerm + this.c.logP0)
      e1 += k * p
      e2 += k * k * p
    } while (k < mode || logTerm + this.c.logP0 > LOG_TOL)
    return e2 - e1 * e1
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const { lambda, nu } = this.p
    const logLambda = Math.log(lambda)
    const LOG_TOL = Math.log(1e-14)
    const mode = Math.pow(lambda, 1 / nu)
    let e1 = 0
    let e2 = 0
    let e3 = 0
    let logTerm = 0
    let k = 0
    do {
      k++
      logTerm += logLambda - nu * Math.log(k)
      const p = Math.exp(logTerm + this.c.logP0)
      e1 += k * p
      e2 += k * k * p
      e3 += k * k * k * p
    } while (k < mode || logTerm + this.c.logP0 > LOG_TOL)
    const variance = e2 - e1 * e1
    const kappa3 = e3 - 3 * e1 * e2 + 2 * Math.pow(e1, 3)
    return kappa3 / Math.pow(variance, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const { lambda, nu } = this.p
    const logLambda = Math.log(lambda)
    const LOG_TOL = Math.log(1e-14)
    const mode = Math.pow(lambda, 1 / nu)
    let e1 = 0
    let e2 = 0
    let e3 = 0
    let e4 = 0
    let logTerm = 0
    let k = 0
    do {
      k++
      logTerm += logLambda - nu * Math.log(k)
      const p = Math.exp(logTerm + this.c.logP0)
      e1 += k * p
      e2 += k * k * p
      e3 += k * k * k * p
      e4 += k * k * k * k * p
    } while (k < mode || logTerm + this.c.logP0 > LOG_TOL)
    const variance = e2 - e1 * e1
    const mu4 = e4 - 4 * e1 * e3 + 6 * e1 * e1 * e2 - 3 * Math.pow(e1, 4)
    return mu4 / (variance * variance) - 3
  }
}
