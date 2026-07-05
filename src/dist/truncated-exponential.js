import Exponential from './exponential'
import Distribution from './_distribution'

/**
 * Probability density function for the [truncated exponential distribution]{@link https://en.wikipedia.org/wiki/Truncated_distribution}:
 *
 * $f(x; \lambda, a, b) = \frac{\lambda e^{-\lambda x}}{e^{-\lambda a} - e^{-\lambda b}},$
 *
 * with $\lambda > 0$, $a \ge 0$, and $b > a$. Support: $x \in [a, b]$.
 *
 * @class TruncatedExponential
 * @memberof ran.dist
 * @constructor
 */
export default class TruncatedExponential extends Exponential {
  /**
   * @param {number} lambda Rate parameter.
   * @param {number} a Lower boundary of the support.
   * @param {number} b Upper boundary of the support.
   */
  constructor (lambda, a, b) {
    super(lambda)
    this.k = 3

    // Validate parameters.
    this.p = { lambda, a, b }
    Distribution.validate({ lambda, a, b }, [
      'lambda > 0',
      'a >= 0',
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

    // Speed-up constants — merge with parent Exponential constants.
    const expNegLambdaA = Math.exp(-lambda * a)
    const expNegLambdaB = Math.exp(-lambda * b)
    Object.assign(this.c, {
      expNegLambdaA,
      expNegLambdaB,
      Z: expNegLambdaA - expNegLambdaB
    })
  }

  _generator () {
    return this._q(this.r.next())
  }

  _pdf (x) {
    return this.p.lambda * Math.exp(-this.p.lambda * x) / this.c.Z
  }

  _cdf (x) {
    return (this.c.expNegLambdaA - Math.exp(-this.p.lambda * x)) / this.c.Z
  }

  _q (p) {
    return -Math.log(this.c.expNegLambdaA - p * this.c.Z) / this.p.lambda
  }

  /**
   * @returns {number} Mean of the distribution.
   */
  mean () {
    const { lambda, a, b } = this.p
    const { expNegLambdaA, expNegLambdaB, Z } = this.c
    const inv = 1 / lambda
    return ((a + inv) * expNegLambdaA - (b + inv) * expNegLambdaB) / Z
  }

  /**
   * @returns {number} Variance of the distribution.
   */
  variance () {
    const { lambda, a, b } = this.p
    const { expNegLambdaA, expNegLambdaB, Z } = this.c
    const inv = 1 / lambda
    const inv2 = inv * inv
    const e2 = ((a * a + 2 * a * inv + 2 * inv2) * expNegLambdaA - (b * b + 2 * b * inv + 2 * inv2) * expNegLambdaB) / Z
    const mu = this.mean()
    return e2 - mu * mu
  }

  static _fitInit (data) {
    const n = data.length
    const a = Math.max(0, Math.min(...data))
    const b = Math.max(...data)
    const mu = data.reduce((s, x) => s + x, 0) / n
    // Method-of-moments: for the truncated exponential, E[X] ≈ a + 1/λ when b >> a,
    // giving λ ≈ 1/(mean − a).
    const lambda = mu > a + 1e-10 ? 1 / (mu - a) : 1
    return [lambda, a, b > a ? b : a + 1]
  }
}
