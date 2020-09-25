import Distribution from './_distribution'

/**
 * Generator for the [arbitrarily bounded arcsine distribution]{@link https://en.wikipedia.org/wiki/Arcsine_distribution#Arbitrary_bounded_support}:
 *
 * $$f(x; a, b) = \frac{1}{\pi \sqrt{(x -a) (b - x)}},$$
 *
 * where $a, b \in \mathbb{R}$ and $a < b$.
 * Support: $x \in \[a, b\]$.
 *
 * @class Arcsine
 * @memberof ran.dist
 * @param {number=} a Lower boundary. Default value is 0.
 * @param {number=} b Upper boundary. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  // Source: Feller (1991). An Introduction to Probability Theory and Its Applications — Volume 2, Second Edition,
  // John Wiley and Sons, p. 79.
  constructor (a = 0, b = 1) {
    super('continuous', arguments.length)

    // Set parameters
    this.p = { a, b }
    Distribution.validate({ a, b }, [
      'a < b'
    ])

    // Set support
    this.s = [{
      value: a,
      closed: true
    }, {
      value: b,
      closed: true
    }]

    // Speed-up constants
    this.c = [
      1 / Math.PI,
      b - a,
      0.5 * Math.PI
    ]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return this.c[0] / Math.sqrt((x - this.p.a) * (this.p.b - x))
  }

  _cdf (x) {
    return 2 * this.c[0] * Math.asin(Math.sqrt((x - this.p.a) / this.c[1]))
  }

  _q (p) {
    const s = Math.sin(this.c[2] * p)
    return (s * s) * this.c[1] + this.p.a
  }
}
