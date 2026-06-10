import Distribution from './_distribution'

/**
 * Probability density function for the [log-logistic distribution]{@link https://en.wikipedia.org/wiki/Log-logistic_distribution} (also known as Fisk distribution):
 *
 * $f(x; \alpha, \beta) = \frac{(\beta / \alpha) (x / \alpha)^{\beta - 1}}{\[1 + (x / \alpha)^\beta\]^2},$
 *
 * with $\alpha, \beta > 0$. Support: $x \in [0, \infty)$.
 *
 * @class LogLogistic
 * @memberof ran.dist
 * @constructor
 */
export default class LogLogistic extends Distribution {
  /**
   * @param {number} alpha Scale parameter.
   * @param {number} beta Shape parameter.
   */
  constructor (alpha, beta) {
    super('continuous', 2)

    // Validate parameters
    this.p = { alpha, beta }
    Distribution.validate({ alpha, beta }, [
      'alpha > 0',
      'beta > 0'
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
      betaOverAlpha: beta / alpha
    }
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const xa = x / this.p.alpha
    const y = Math.pow(xa, this.p.beta - 1)
    return this.c.betaOverAlpha * y / Math.pow(1 + xa * y, 2)
  }

  _cdf (x) {
    return 1 / (1 + Math.pow(x / this.p.alpha, -this.p.beta))
  }

  _q (p) {
    return this.p.alpha * Math.pow(1 / p - 1, -1 / this.p.beta)
  }

  static _fitInit (data) {
    // log(Y) ~ Logistic(log(alpha), 1/beta): MOM on log scale exploits the log-logistic/logistic link
    const n = data.length
    const logData = data.map(x => Math.log(x))
    const meanLog = logData.reduce((s, x) => s + x, 0) / n
    const stdLog = Math.sqrt(logData.reduce((s, x) => s + (x - meanLog) ** 2, 0) / n) || 1
    return [Math.exp(meanLog), Math.PI / (stdLog * Math.sqrt(3))]
  }
}
