import Distribution from './_distribution'

/**
 * Generator for the [Dagum distribution]{@link https://en.wikipedia.org/wiki/Dagum_distribution}:
 *
 * $$f(x; p, a, b) = \frac{ap}{x} \frac{\big(\frac{x}{b}\big)^{ap}}{\Big[\big(\frac{x}{b}\big)^a + 1\Big]^{p + 1}},$$
 *
 * with \(p, a, b \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
 *
 * @class Dagum
 * @memberOf ran.dist
 * @param {number=} p First shape parameter. Default value is 1.
 * @param {number=} a Second shape parameter. Default value is 1.
 * @param {number=} b Scale parameter. Default value is 1.
 */
export default class extends Distribution {
  constructor (p = 1, a = 1, b = 1) {
    super('continuous', arguments.length)
    this.p = { p, a, b }
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    return this.p.b * Math.pow(Math.pow(this.r.next(), -1 / this.p.p) - 1, -1 / this.p.a)
  }

  _pdf (x) {
    let y = Math.pow(x / this.p.b, this.p.a)
    return this.p.a * this.p.p * Math.pow(y, this.p.p) / (x * Math.pow(y + 1, this.p.p + 1))
  }

  _cdf (x) {
    return Math.pow(1 + Math.pow(x / this.p.b, -this.p.a), -this.p.p)
  }
}
