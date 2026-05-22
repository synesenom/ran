import Distribution from './_distribution'

/**
 * Generator for the [anglit distribution]{@link https://docs.scipy.org/doc/scipy-1.0.0/reference/tutorial/stats/continuous_anglit.html}:
 *
 * $$f(x; \mu, \beta) = \frac{1}{\beta} \cos\bigg(2 \frac{x - \mu}{\beta}\bigg),$$
 *
 * where $\mu \in \mathbb{R}$ and $\beta > 0$.
 * Support: $x \in \Big\[\mu-\frac{\beta \pi}{4}, \mu + \frac{\beta \pi}{4}\Big\]$.
 *
 * @class Anglit
 * @memberof ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} beta Scale parameter. Default value is 1.
 * @see https://docs.scipy.org/doc/scipy-1.0.0/reference/tutorial/stats/continuous_anglit.html
 * @constructor
 */
export default class extends Distribution {
  // Source: King (2017). Statistics for Process control engineers, John Wiley and Sons, p. 472.
  constructor (mu, beta) {
    super('continuous', 2)

    // Validate parameters
    this.p = { mu, beta }
    Distribution.validate({ mu, beta }, [
      'beta > 0'
    ])

    // Set support
    this.s = [{
      value: mu - Math.PI * beta / 4,
      closed: true
    }, {
      value: mu + Math.PI * beta / 4,
      closed: true
    }]

    // Speed-up constants
    this.c = {
      twoOverBeta: 2 / beta,
      twoMuOverBeta: 2 * mu / beta,
      oneOverBeta: 1 / beta,
      muOverBetaMinusPiOver4: mu / beta - Math.PI / 4
    }
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return Math.cos(this.c.twoOverBeta * x - this.c.twoMuOverBeta) / this.p.beta
  }

  _cdf (x) {
    return Math.pow(Math.sin(this.c.oneOverBeta * x - this.c.muOverBetaMinusPiOver4), 2)
  }

  _q (p) {
    return this.p.mu + this.p.beta * (Math.asin(Math.sqrt(p)) - Math.PI / 4)
  }
}
