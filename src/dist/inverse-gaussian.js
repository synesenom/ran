import { erf, erfc } from '../special'
import normal from './_normal'
import Distribution from './_distribution'

/**
 * Generator for the Wald or [inverse Gaussian distribution]{@link https://en.wikipedia.org/wiki/Inverse_Gaussian_distribution}:
 *
 * $f(x; \lambda, \mu) = \bigg\[\frac{\lambda}{2 \pi x^3}\bigg\]^{1/2} e^{\frac{-\lambda (x - \mu)^2}{2 x \mu^2}},$
 *
 * with $\mu, \lambda > 0$. Support: $x > 0$.
 *
 * @class InverseGaussian
 * @memberof ran.dist
 * @see J. R. Michael, W. R. Schucany and R. W. Haas, "Generating Random Variates Using Transformations with Multiple Roots", Am. Stat. 30(2), 88–90, 1976.
 * @constructor
 */
export default class InverseGaussian extends Distribution {
  /**
   * @param {number} mu Mean of the distribution.
   * @param {number} lambda Shape parameter.
   */
  constructor (mu, lambda) {
    super('continuous', 2)

    // Validate parameters
    this.p = { mu, lambda }
    Distribution.validate({ mu, lambda }, [
      'mu > 0',
      'lambda > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    this.c = {
      halfMuOverLambda: 0.5 * mu / lambda,
      expTwoLambdaOverMu: Math.exp(2 * lambda / mu),
      sqrtLambdaOverMuSq: Math.sqrt(lambda / (mu * mu))
    }
  }

  _generator () {
    // Direct sampling
    const nu = normal(this.r)

    const y = nu * nu

    const x = this.p.mu + this.c.halfMuOverLambda * this.p.mu * y - this.c.halfMuOverLambda * Math.sqrt(this.p.mu * y * (4 * this.p.lambda + this.p.mu * y))
    return this.r.next() > this.p.mu / (this.p.mu + x) ? this.p.mu * this.p.mu / x : x
  }

  _pdf (x) {
    return Math.sqrt(this.p.lambda / (2 * Math.PI * Math.pow(x, 3))) * Math.exp(-this.p.lambda * Math.pow(x - this.p.mu, 2) / (2 * this.p.mu * this.p.mu * x))
  }

  _cdf (x) {
    const s = Math.sqrt(this.p.lambda / x)
    const st = Math.sqrt(x) * this.c.sqrtLambdaOverMuSq
    const z = erf(Math.SQRT1_2 * (st - s))

    // Handle 1 - z << 1 case
    if (1 - z > Number.EPSILON) {
      return Math.min(1, 0.5 * (1 + z + this.c.expTwoLambdaOverMu * erfc(Math.SQRT1_2 * (st + s))))
    } else {
      return Math.min(1, 0.5 * (erfc(Math.SQRT1_2 * (s - st)) + this.c.expTwoLambdaOverMu * erfc(Math.SQRT1_2 * (st + s))))
    }
  }
}
