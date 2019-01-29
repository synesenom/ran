import Distribution from './_distribution'

/**
 * Generator for the [Kumaraswamy distribution]{@link https://en.wikipedia.org/wiki/Kumaraswamy_distribution} (also
 * known as Minimax distribution):
 *
 * $$f(x; a, b) = a b x^{a-1} (1 - x^a)^{b - 1},$$
 *
 * with \(a, b \in \mathbb{R}^+\). Support: \(x \in (0, 1)\).
 *
 * @class Kumaraswamy
 * @memberOf ran.dist
 * @param {number=} alpha First shape parameter. Default value is 1.
 * @param {number=} beta Second shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (a = 1, b = 1) {
    super('continuous', arguments.length)
    this.p = { a, b }
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: 1,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    return Math.pow(1 - Math.pow(1 - Math.random(), 1 / this.p.b), 1 / this.p.a)
  }

  _pdf (x) {
    return this.p.a * this.p.b * Math.pow(x, this.p.a - 1) * Math.pow(1 - Math.pow(x, this.p.a), this.p.b - 1)
  }

  _cdf (x) {
    return 1 - Math.pow(1 - Math.pow(x, this.p.a), this.p.b)
  }
}
