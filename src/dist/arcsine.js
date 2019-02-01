import Distribution from './_distribution'

/**
 * Generator for the [arbitrarily bounded arcsine distribution]{@link https://en.wikipedia.org/wiki/Arcsine_distribution#Arbitrary_bounded_support}:
 *
 * $$f(x; a, b) = \frac{1}{\pi \sqrt{(x -a) (b - x)}},$$
 *
 * where \(a, b \in \mathbb{R}\) and \(a < b\). Support: \(x \in [a, b]\).
 *
 * @class Arcsine
 * @memberOf ran.dist
 * @param {number=} a Lower boundary. Default value is 0.
 * @param {number=} b Upper boundary. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (a = 0, b = 1) {
    super('continuous', arguments.length)
    this.p = { a, b }
    this.s = [{
      value: a,
      closed: true
    }, {
      value: b,
      closed: true
    }]
    this.c = [1 / Math.PI, b - a]
  }

  _generator () {
    // Inverse transform sampling
    let s = Math.sin(0.5 * Math.PI * Math.random())
    return (s * s) * this.c[1] + this.p.a
  }

  _pdf (x) {
    return this.c[0] / Math.sqrt((x - this.p.a) * (this.p.b - x))
  }

  _cdf (x) {
    return 2 * this.c[0] * Math.asin(Math.sqrt((x - this.p.a) / (this.p.b - this.p.a)))
  }
}
