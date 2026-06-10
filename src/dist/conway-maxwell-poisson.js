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
 * Cumulative distribution function:
 *
 * $F(k; \lambda, \nu) = \sum_{i=0}^{k} \frac{\lambda^i}{(i!)^{\nu} Z(\lambda, \nu)}$
 *
 * where $Z(\lambda, \nu) = \sum_{j=0}^{\infty} \frac{\lambda^j}{(j!)^{\nu}}$ is the normalizing constant
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

    this.c = {
      logP0: -logZ
    }
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
}
