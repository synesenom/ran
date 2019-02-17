import Normal from './normal'

/**
 * Generator for the [Birnbaum-Saunders distribution]{@link https://en.wikipedia.org/wiki/Birnbaum%E2%80%93Saunders_distribution}:
 *
 * $$f(x; \mu, \beta, \gamma) = \frac{z + 1 / z}{2 \gamma (x - \mu)} \phi\Big(\frac{z - 1 / z}{\gamma}\Big),$$
 *
 * with \(mu \in \mathbb{R}\), \(\beta, \gamma \in \mathbb{R}^+\), \(z = \sqrt{\frac{x - \mu}{\beta}}\) and \(\phi(x)\) is the probability density function of the standard normal distribution. Support: \(x \in (\mu, \infty)\).
 *
 * @class BirnbaumSaunders
 * @memberOf ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} beta Scale parameter. Default value is 1.
 * @param {number=} gamma Shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Normal {
  // Transformation of normal distribution
  constructor (mu = 0, beta = 1, gamma = 1) {
    super()
    this.p = Object.assign({ mu2: mu, beta, gamma }, this.p)
    this.s = [{
      value: mu,
      closed: false
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling by transforming normal variate
    let n = this.p.gamma * super._generator()
    return this.p.beta * 0.25 * Math.pow(n + Math.sqrt(4 + Math.pow(n, 2)), 2) + this.p.mu2
  }

  _pdf (x) {
    let z = Math.sqrt((x - this.p.mu2) / this.p.beta)
    return (z + 1 / z) * super._pdf((z - 1 / z) / this.p.gamma) / (2 * this.p.gamma * (x - this.p.mu2))
  }

  _cdf (x) {
    let z = Math.sqrt((x - this.p.mu2) / this.p.beta)
    return super._cdf((z - 1 / z) / this.p.gamma)
  }
}
