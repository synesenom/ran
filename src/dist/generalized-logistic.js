import Distribution from './_distribution'

/**
 * Probability density function for the [generalized logistic distribution]{@link https://en.wikipedia.org/wiki/Generalized_logistic_distribution}:
 *
 * $f(x; \mu, s, c) = \frac{c e^{-z}}{s (1 + e^{-z})^{c + 1}},$
 *
 * with $z = \frac{x - \mu}{s}$, $\mu \in \mathbb{R}$ and $s, c > 0$. Support: $x \in \mathbb{R}$.
 *
 * Cumulative distribution function:
 *
 * $F(x; \mu, s, c) = \frac{1}{\left(1 + e^{-(x-\mu)/s}\right)^{c}}$
 *
 * @class GeneralizedLogistic
 * @memberof ran.dist
 * @constructor
 */
export default class GeneralizedLogistic extends Distribution {
  /**
   * @param {number} mu Location parameter.
   * @param {number} s Scale parameter.
   * @param {number} c Shape parameter.
   */
  constructor (mu, s, c) {
    super('continuous', 3)

    // Validate parameters
    this.p = { mu, s, c }
    Distribution.validate({ mu, s, c }, [
      's > 0',
      'c > 0'
    ])

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
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
    const z = Math.exp(-(x - this.p.mu) / this.p.s)
    return Number.isFinite(z * z)
      ? this.p.c * z / (this.p.s * Math.pow(1 + z, this.p.c + 1))
      : 0
  }

  _cdf (x) {
    return 1 / Math.pow(1 + Math.exp(-(x - this.p.mu) / this.p.s), this.p.c)
  }

  _q (p) {
    return this.p.mu - this.p.s * Math.log(Math.pow(p, -1 / this.p.c) - 1)
  }

  static _fitInit (data) {
    // At c=1 (logistic special case) Var[X] = pi^2 s^2 / 3 and mean = mu give the same MOM as Logistic
    const n = data.length
    const mu = data.reduce((s, x) => s + x, 0) / n
    const v = data.reduce((s, x) => s + (x - mu) ** 2, 0) / n
    return [mu, Math.max(Math.sqrt(3 * v) / Math.PI, 1e-3), 1]
  }
}
