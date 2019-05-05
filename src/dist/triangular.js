import Distribution from './_distribution'

/**
 * Generator for the asymmetric [triangular distribution]{@link https://en.wikipedia.org/wiki/Triangular_distribution}:
 *
 * $$f(x; a, b, c) = \begin{cases}0 &\quad\text{for $x < a$},\\\frac{2 (x - a)}{(b - a) (c - a)} &\quad\text{for $a \le x < c$}\\\frac{2 (b - x)}{(b - a) (b - c)} &\quad\text{for $c \le x \le b$}\\0 &\quad\text{for $b < x$} \\\end{cases},$$
 *
 * with \(a, b, c \in \mathbb{R}\), \(a < b\) and \(a \le c \le b\). Support: \(x \in [a, b]\).
 *
 * @class Triangular
 * @memberOf ran.dist
 * @param {number=} a Lower bound of the support. Default value is 0.
 * @param {number=} b Upper bound of the support. Default value is 1.
 * @param {number=} c Mode of the distribution. Default value is 0.5.
 * @constructor
 */
export default class extends Distribution {
  constructor (a = 0, b = 1, c = 0.5) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { a, b, c }
    Distribution._validate({ a, b, c }, [
      'a < b',
      'a <= c', 'c <= b'
    ])

    // Set support
    this.s = [{
      value: a,
      closed: true
    }, {
      value: b,
      closed: true
    }]

    // TODO Speed-up constants
    this.c = [
      b - a,
      b - c,
      c - a
    ]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return x < this.p.c
      ? 2 * (x - this.p.a) / (this.c[0] * this.c[2])
      : 2 * (this.p.b - x) / (this.c[0] * this.c[1])
  }

  _cdf (x) {
    return x < this.p.c
      ? Math.pow(x - this.p.a, 2) / (this.c[0] * this.c[2])
      : 1 - Math.pow(this.p.b - x, 2) / (this.c[0] * this.c[1])
  }

  _q (p) {
    return p < this.c[2] / this.c[0]
      ? this.p.a + Math.sqrt(p * this.c[0] * this.c[2])
      : this.p.b - Math.sqrt((1 - p) * this.c[0] * this.c[1])
  }
}
