import Gamma from './gamma'
import Distribution from './_distribution'

/**
 * Generator for the [log-gamma distribution]{@link https://reference.wolfram.com/language/ref/LogGammaDistribution.html} using the
 * shape/rate parametrization:
 *
 * $$f(x; \alpha, \beta, \mu) = \frac{\beta^\alpha}{\Gamma(\alpha)} \ln^{\alpha - 1}(x - \mu + 1) (x - \mu + 1)^{-(1 + \beta)},$$
 *
 * where $\alpha, \beta > 0$ and $\mu \ge 0$. Support: $x \in [\mu, \infty)$.
 *
 * @class LogGamma
 * @memberof ran.dist
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @param {number=} beta Rate parameter. Default value is 1.
 * @param {number=} mu Location parameter. Default value is 0.
 * @constructor
 */
export default class extends Gamma {
  constructor (alpha = 1, beta = 1, mu = 0) {
    super(alpha, beta)

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
}
