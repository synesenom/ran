import Distribution from './_distribution'

/**
 * Generator for the [logistic distribution]{@link https://en.wikipedia.org/wiki/Logistic_distribution}:
 *
 * $$f(x; \mu, s) = \frac{e^{-z}}{s (1 + e^{-z})^2},$$
 *
 * with \(z = \frac{x - \mu}{s}\), \(\mu \in \mathbb{R}\) and \(s \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}\).
 *
 * @class Logistic
 * @memberOf ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} s Scale parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (mu = 0, s = 1) {
    super('continuous', arguments.length)
    this.p = { mu, s }
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
    return this.p.mu - this.p.s * Math.log(1 / this.r.next() - 1)
  }

  _pdf (x) {
    let z = Math.exp(-(x - this.p.mu) / this.p.s)
    return isFinite(z * z)
      ? z / (this.p.s * Math.pow(1 + z, 2))
      : 0
  }

  _cdf (x) {
    return 1 / (1 + Math.exp(-(x - this.p.mu) / this.p.s))
  }
}
