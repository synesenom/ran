import Distribution from './_distribution'

/**
 * Probability density function for the [logistic distribution]{@link https://en.wikipedia.org/wiki/Logistic_distribution}:
 *
 * $f(x; \mu, s) = \frac{e^{-z}}{s (1 + e^{-z})^2},$
 *
 * with $z = \frac{x - \mu}{s}$, $\mu \in \mathbb{R}$ and $s > 0$. Support: $x \in \mathbb{R}$.
 *
 * @class Logistic
 * @memberof ran.dist
 * @constructor
 */
export default class Logistic extends Distribution {
  /**
   * @param {number} mu Location parameter.
   * @param {number} s Scale parameter.
   */
  constructor (mu, s) {
    super('continuous', 2)

    // Validate parameters
    this.p = { mu, s }
    Distribution.validate({ mu, s }, [
      's > 0'
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
      ? z / (this.p.s * Math.pow(1 + z, 2))
      : 0
  }

  _cdf (x) {
    return 1 / (1 + Math.exp(-(x - this.p.mu) / this.p.s))
  }

  _q (p) {
    return this.p.mu - this.p.s * Math.log(1 / p - 1)
  }
}
