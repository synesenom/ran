import Distribution from './_distribution'

/**
 * Generator for the [Laplace distribution]{@link https://en.wikipedia.org/wiki/Laplace_distribution} (also known as [double exponential distribution]{@link https://www.itl.nist.gov/div898/handbook/eda/section3/eda366c.htm}):
 *
 * $$f(x; \mu, b) = \frac{1}{2b}e^{-\frac{|x - \mu|}{b}},$$
 *
 * where \(\mu \in \mathbb{R}\) and \(b > 0\). Support: \(x \in \mathbb{R}\).
 *
 * @class Laplace
 * @memberOf ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} b Scale parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (mu = 0, b = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { mu, b }
    Distribution._validate({ mu, b }, [
      'b > 0'
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
    // Direct sampling from uniform
    return this.p.mu + this.p.b * Math.log(this.r.next() / this.r.next())
  }

  _pdf (x) {
    return 0.5 * Math.exp(-Math.abs(x - this.p.mu) / this.p.b) / this.p.b
  }

  _cdf (x) {
    let z = Math.exp((x - this.p.mu) / this.p.b)
    return x < this.p.mu ? 0.5 * z : 1 - 0.5 / z
  }

  _q (p) {
    return p < 0.5
      ? this.p.mu + this.p.b * Math.log(2 * p)
      : this.p.mu - this.p.b * Math.log(2 - 2 * p)
  }
}
