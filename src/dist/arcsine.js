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

  static _fitInit (data) {
    // E[X]=(a+b)/2, Var[X]=(b−a)²/8: invert to get a = mean−√(2·var), b = mean+√(2·var)
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1
    const halfRange = Math.sqrt(2 * variance)
    return [mean - halfRange, mean + halfRange]
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

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return (this.p.a + this.p.b) / 2
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    return (this.p.b - this.p.a) ** 2 / 8
  }

  /**
   * @returns {number} The skewness of the distribution (zero by symmetry).
   */
  skewness () {
    return 0
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    return -1.5
  }
}
