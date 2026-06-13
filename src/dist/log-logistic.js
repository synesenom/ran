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

  /**
   * @returns {number} The mean, $\frac{\alpha\pi/\beta}{\sin(\pi/\beta)}$, or `Infinity` when $\beta \le 1$.
   */
  mean () {
    const { alpha, beta } = this.p
    return beta > 1 ? alpha * Math.PI / beta / Math.sin(Math.PI / beta) : Infinity
  }

  /**
   * @returns {number} The variance, or `Infinity` when $\beta \le 2$.
   */
  variance () {
    const { alpha, beta } = this.p
    if (beta <= 2) return Infinity
    const m1 = alpha * Math.PI / beta / Math.sin(Math.PI / beta)
    const m2 = alpha * alpha * 2 * Math.PI / beta / Math.sin(2 * Math.PI / beta)
    return m2 - m1 * m1
  }

  /**
   * @returns {number} The skewness, or `Infinity` when $2 < \beta \le 3$, `NaN` when $\beta \le 2$.
   */
  skewness () {
    const { alpha, beta } = this.p
    if (beta <= 2) return NaN
    if (beta <= 3) return Infinity
    const a = alpha
    const m1 = a * Math.PI / beta / Math.sin(Math.PI / beta)
    const m2 = a * a * 2 * Math.PI / beta / Math.sin(2 * Math.PI / beta)
    const m3 = a * a * a * 3 * Math.PI / beta / Math.sin(3 * Math.PI / beta)
    const v = m2 - m1 * m1
    return (m3 - 3 * m1 * m2 + 2 * m1 * m1 * m1) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis, or `Infinity` when $2 < \beta \le 4$, `NaN` when $\beta \le 2$.
   */
  kurtosis () {
    const { alpha, beta } = this.p
    if (beta <= 2) return NaN
    if (beta <= 4) return Infinity
    const a = alpha
    const m1 = a * Math.PI / beta / Math.sin(Math.PI / beta)
    const m2 = a * a * 2 * Math.PI / beta / Math.sin(2 * Math.PI / beta)
    const m3 = a * a * a * 3 * Math.PI / beta / Math.sin(3 * Math.PI / beta)
    const m4 = a * a * a * a * 4 * Math.PI / beta / Math.sin(4 * Math.PI / beta)
    const v = m2 - m1 * m1
    return (m4 - 4 * m1 * m3 + 6 * m1 * m1 * m2 - 3 * m1 * m1 * m1 * m1) / (v * v) - 3
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
