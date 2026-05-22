import Distribution from './_distribution'

/**
 * Generator for the [trapezoidal distribution]{@link https://en.wikipedia.org/wiki/Trapezoidal_distribution}:
 *
 * $$f(x; a, b, c, d) = \begin{cases}0 &\quad\text{for $x < a$},\\\\ \frac{2 (x - a)}{(b - a) (d + c - a - b)} &\quad\text{for $a \le x < b$}\\\\ \frac{2}{d + c - a - b} &\quad\text{for $b \le x < c$}\\\\ \frac{2 (d - x)}{(d - c) (d + c - a - b)} &\quad\text{for $c \le x \le d$}\\\\ 0 &\quad\text{for $d < x$} \\\\ \end{cases},$$
 *
 * where $a, b, c, d \in \mathbb{R}$, $a < d$, $a \le b < c$ and $c \le d$. Support: $x \in \[a, d\]$.
 *
 * @class Trapezoidal
 * @memberof ran.dist
 * @param {number=} a Lower bound of the support. Default value is 0.
 * @param {number=} b Start of the level part. Default value is 0.33.
 * @param {number=} c End of the level part. Default value is 0.67.
 * @param {number=} d Upper bound of the support. Default value is 1.
 * @see https://en.wikipedia.org/wiki/Trapezoidal_distribution
 * @constructor
 */
export default class extends Distribution {
  constructor (a, b, c, d) {
    super('continuous', 4)

    // Validate parameters
    this.p = { a, b, c, d }
    Distribution.validate({ a, b, c, d }, [
      'a < d',
      'a <= b', 'b < c',
      'c <= d'
    ])

    // Set support
    this.s = [{
      value: a,
      closed: true
    }, {
      value: d,
      closed: true
    }]

    // Speed-up constants
    this.c = {
      scale: d + c - a - b,
      ba: b - a,
      dc: d - c,
      aPb: a + b
    }
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    if (x < this.p.b) {
      return 2 * (x - this.p.a) / (this.c.ba * this.c.scale)
    } else if (x < this.p.c) {
      return 2 / this.c.scale
    } else {
      return 2 * (this.p.d - x) / (this.c.dc * this.c.scale)
    }
  }

  _cdf (x) {
    if (x < this.p.b) {
      return Math.pow(x - this.p.a, 2) / (this.c.ba * this.c.scale)
    } else if (x < this.p.c) {
      return (2 * x - this.c.aPb) / this.c.scale
    } else {
      return 1 - Math.pow(this.p.d - x, 2) / (this.c.dc * this.c.scale)
    }
  }

  _q (p) {
    if (p < this.c.ba / this.c.scale) {
      return this.p.a + Math.sqrt(this.c.scale * this.c.ba * p)
    } else if (p < (2 * this.p.c - this.c.aPb) / this.c.scale) {
      return (this.c.scale * p + this.c.aPb) / 2
    } else {
      return this.p.d - Math.sqrt(this.c.scale * this.c.dc * (1 - p))
    }
  }
}
