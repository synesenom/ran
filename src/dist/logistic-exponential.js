import Distribution from './_distribution'

/**
 * Generator for the [logistic-exponential distribution]{@link http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.295.8653&rep=rep1&type=pdf}:
 *
 * $f(x; \lambda, \kappa) = \frac{\lambda \kappa (e^{\lambda x} - 1)^{\kappa - 1} e^{\lambda x}}{\[1 + (e^{\lambda x} - 1)^\kappa\]^2},$
 *
 * where $\lambda, \kappa > 0$. Support: $x > 0$.
 *
 * @class LogisticExponential
 * @memberof ran.dist
 * @see http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.295.8653&rep=rep1&type=pdf
 * @constructor
 */
export default class LogisticExponential extends Distribution {
  /**
   * @param {number} lambda Scale parameter.
   * @param {number} kappa Shape parameter.
   */
  constructor (lambda, kappa) {
    super('continuous', 2)

    // Validate parameters
    this.p = { lambda, kappa }
    Distribution.validate({ lambda, kappa }, [
      'lambda > 0',
      'kappa > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: kappa >= 1
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const y = Math.exp(this.p.lambda * x)
    return Number.isFinite(Math.pow(y, 2 * this.p.kappa)) ? this.p.lambda * this.p.kappa * Math.pow(y - 1, this.p.kappa - 1) * y / Math.pow(1 + Math.pow(y - 1, this.p.kappa), 2) : 0
  }

  _cdf (x) {
    // u/(1+u) avoids cancellation in 1-1/(1+u) when u = expm1(lambda*x)^kappa is near 0;
    // guard against overflow: expm1(large) = Infinity, so u/(1+u) = NaN — return 1 instead
    const u = Math.pow(Math.expm1(this.p.lambda * x), this.p.kappa)
    return Number.isFinite(u) ? u / (1 + u) : 1
  }

  _q (p) {
    const z = Math.pow(p / (1 - p), 1 / this.p.kappa)

    // Handle z << 1 cases
    return 1 + z === 1
      ? z / this.p.lambda
      : Math.log(1 + z) / this.p.lambda
  }
}
