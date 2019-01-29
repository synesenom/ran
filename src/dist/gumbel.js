import Distribution from './_distribution'

/**
 * Generator for the [Gumbel distribution]{@link https://en.wikipedia.org/wiki/Gumbel_distribution}:
 *
 * $$f(x; \mu, \beta) = \frac{1}{\beta} e^{-(z + e^-z)},$$
 *
 * with \(z = \frac{x - \mu}{\beta}\) and \(\mu \in \mathbb{R}\), \(\beta \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}\).
 *
 * @class Gumbel
 * @memberOf ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} beta Scale parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (mu = 0, beta = 1) {
    super('continuous', arguments.length)
    this.p = { mu, beta }
    this.s = [{
      value: null,
      closed: false
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    return this.p.mu - this.p.beta * Math.log(-Math.log(Math.random()))
  }

  _pdf (x) {
    let z = (x - this.p.mu) / this.p.beta
    return Math.exp(-(z + Math.exp(-z))) / this.p.beta
  }

  _cdf (x) {
    return Math.exp(-Math.exp(-(x - this.p.mu) / this.p.beta))
  }
}
