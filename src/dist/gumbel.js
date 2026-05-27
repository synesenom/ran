import Distribution from './_distribution'

/**
 * Probability density function for the [Gumbel distribution]{@link https://en.wikipedia.org/wiki/Gumbel_distribution}:
 *
 * $f(x; \mu, \beta) = \frac{1}{\beta} e^{-(z + e^{-z})},$
 *
 * with $z = \frac{x - \mu}{\beta}$ and $\mu \in \mathbb{R}$, $\beta > 0$. Support: $x \in \mathbb{R}$.
 *
 * @class Gumbel
 * @memberof ran.dist
 * @constructor
 */
export default class Gumbel extends Distribution {
  /**
   * @param {number} mu Location parameter.
   * @param {number} beta Scale parameter.
   */
  constructor (mu, beta) {
    super('continuous', 2)

    // Validate parameters
    this.p = { mu, beta }
    Distribution.validate({ mu, beta }, [
      'beta > 0'
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
    const z = (x - this.p.mu) / this.p.beta
    return Math.exp(-(z + Math.exp(-z))) / this.p.beta
  }

  _cdf (x) {
    return Math.exp(-Math.exp(-(x - this.p.mu) / this.p.beta))
  }

  _q (p) {
    return this.p.mu - this.p.beta * Math.log(-Math.log(p))
  }
}
