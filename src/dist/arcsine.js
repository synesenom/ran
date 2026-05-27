import Distribution from './_distribution'

/**
 * Probability density function for the [arbitrarily bounded arcsine distribution]{@link https://en.wikipedia.org/wiki/Arcsine_distribution#Arbitrary_bounded_support}:
 *
 * $f(x; a, b) = \frac{1}{\pi \sqrt{(x -a) (b - x)}},$
 *
 * where $a, b \in \mathbb{R}$ and $a < b$.
 * Support: $x \in \[a, b\]$.
 *
 * @class Arcsine
 * @memberof ran.dist
 * @see W. Feller, An Introduction to Probability Theory and Its Applications Vol. 2, 2nd ed., John Wiley and Sons, 1991, p. 79.
 * @constructor
 */
export default class Arcsine extends Distribution {
  // Source: Feller (1991). An Introduction to Probability Theory and Its Applications — Volume 2, Second Edition,
  // John Wiley and Sons, p. 79.
  /**
   * @param {number} a Lower boundary.
   * @param {number} b Upper boundary.
   */
  constructor (a, b) {
    super('continuous', 2)

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
    this.c = {
      invPi: 1 / Math.PI,
      range: b - a,
      halfPi: 0.5 * Math.PI
    }
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return this.c.invPi / Math.sqrt((x - this.p.a) * (this.p.b - x))
  }

  _cdf (x) {
    return 2 * this.c.invPi * Math.asin(Math.sqrt((x - this.p.a) / this.c.range))
  }

  _q (p) {
    const s = Math.sin(this.c.halfPi * p)
    return (s * s) * this.c.range + this.p.a
  }
}
