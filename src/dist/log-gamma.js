import { gammaLowerIncompleteInv } from '../special'
import Gamma from './gamma'
import Distribution from './_distribution'

/**
 * Probability density function for the [log-gamma distribution]{@link https://reference.wolfram.com/language/ref/LogGammaDistribution.html} using the
 * shape/rate parametrization:
 *
 * $f(x; \alpha, \beta, \mu) = \frac{\beta^\alpha}{\Gamma(\alpha)} \ln^{\alpha - 1}(x - \mu + 1) (x - \mu + 1)^{-(1 + \beta)},$
 *
 * where $\alpha, \beta > 0$ and $\mu \ge 0$. Support: $x \in [\mu, \infty)$.
 *
 * @class LogGamma
 * @memberof ran.dist
 * @constructor
 */
export default class LogGamma extends Gamma {
  /**
   * @param {number} alpha Shape parameter.
   * @param {number} beta Rate parameter.
   * @param {number} mu Location parameter.
   */
  constructor (alpha, beta, mu) {
    super(alpha, beta)
    // LogGamma has 3 free parameters (alpha, beta, mu); override the 2 inherited from Gamma
    this.k = 3

    // Validate parameters
    this.p = Object.assign(this.p, { mu })
    Distribution.validate({ mu }, [
      'mu >= 0'
    ])

    // Set support
    this.s = [{
      value: mu,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _q (p) {
    // LogGamma: X = exp(Y) + mu - 1 where Y ~ Gamma(alpha, beta); invert via exp
    return Math.exp(gammaLowerIncompleteInv(this.p.alpha, p) / this.p.beta) + this.p.mu - 1
  }

  _generator () {
    // Direct sampling by transforming gamma variate
    return Math.exp(super._generator()) + this.p.mu - 1
  }

  _pdf (x) {
    return super._pdf(Math.log(x - this.p.mu + 1)) / (x - this.p.mu + 1)
  }

  _cdf (x) {
    return super._cdf(Math.log(x - this.p.mu + 1))
  }

  static _fitInit (data) {
    // log(x−μ+1) ~ Gamma(α,β) with μ=0: gamma MOM on log(x+1) seeds the Gamma parameters
    const n = data.length
    const transformed = data.map(x => Math.log(x + 1))
    const mean = transformed.reduce((s, x) => s + x, 0) / n
    const variance = transformed.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1
    return [mean ** 2 / variance, mean / variance, 0]
  }
}
