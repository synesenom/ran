import Distribution from './_distribution'

/**
 * Generator for the [anglit distribution]{@link https://docs.scipy.org/doc/scipy-1.0.0/reference/tutorial/stats/continuous_anglit.html}:
 *
 * $$f(x) = \frac{1}{\beta} \cos\bigg(2 \frac{x - \mu}{\beta}\bigg),$$
 *
 * where\(\mu \in \mathbb{R}\) and \(\beta > 0\).
 * Support: \(x \in \Big[\mu-\frac{\beta \pi}{4}, \mu + \frac{\beta \pi}{4}\Big]\).
 *
 * @class Anglit
 * @memberOf ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} beta Scale parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  // Source: King (2017). Statistics for Process control engineers, John Wiley and Sons, p. 472.
  constructor (mu = 0, beta = 1) {
    super('continuous', arguments.length)

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
    this.c = [
      2 / beta,
      2 * mu / beta,
      1 / beta,
      mu / beta - Math.PI / 4
    ]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return Math.cos(this.c[0] * x - this.c[1]) / this.p.beta
  }

  _cdf (x) {
    return Math.pow(Math.sin(this.c[2] * x - this.c[3]), 2)
  }

  _q (p) {
    return this.p.mu + this.p.beta * (Math.asin(Math.sqrt(p)) - Math.PI / 4)
  }
}
