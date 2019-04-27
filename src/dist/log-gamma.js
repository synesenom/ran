import Gamma from './gamma'

/**
 * Generator for the [log-gamma distribution]{@link https://reference.wolfram.com/language/ref/LogGammaDistribution.html} using the
 * shape/rate parametrization:
 *
 * $$f(x; \alpha, \beta) = \frac{\beta^\alpha}{\Gamma(\alpha)} (\ln(x - \mu + 1)]^{\alpha - 1} (x - \mu + 1)^{-(1 + \beta)},$$
 *
 * where \(\alpha, \beta \in \mathbb{R}^+\) and \(\mu \in \mathbb{R}^+ / \{0\}\). Support: \(x \in [\mu, \infty)\).
 *
 * @class LogGamma
 * @memberOf ran.dist
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @param {number=} beta Rate parameter. Default value is 1.
 * @param {number=} mu Location parameter. Default value is 0.
 * @constructor
 */
export default class extends Gamma {
  constructor (alpha = 1, beta = 1, mu = 0) {
    super(alpha, beta)
    this.p = Object.assign(this.p, { mu })
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
