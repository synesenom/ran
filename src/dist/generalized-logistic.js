import Distribution from './_distribution'

/**
 * Generator for the [generalized logistic distribution]{@link https://docs.scipy.org/doc/scipy/reference/tutorial/stats/continuous_genlogistic.html}:
 *
 * $$f(x; \mu, s, c) = \frac{c e^{-z}}{s (1 + e^{-z})^{c + 1}},$$
 *
 * with $z = \frac{x - \mu}{s}$, $\mu \in \mathbb{R}$ and $s, c > 0$. Support: $x \in \mathbb{R}$.
 *
 * @class GeneralizedLogistic
 * @memberof ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} s Scale parameter. Default value is 1.
 * @param {number=} c Shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (mu = 0, s = 1, c = 1) {
    super('continuous', arguments.length)

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
}
