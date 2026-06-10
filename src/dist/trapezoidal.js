import Distribution from './_distribution'

/**
 * Probability density function for the [trapezoidal distribution]{@link https://en.wikipedia.org/wiki/Trapezoidal_distribution}:
 *
 * $f(x; a, b, c, d) = \begin{cases}0 &\quad\text{for $x < a$},\\\\ \frac{2 (x - a)}{(b - a) (d + c - a - b)} &\quad\text{for $a \le x < b$}\\\\ \frac{2}{d + c - a - b} &\quad\text{for $b \le x < c$}\\\\ \frac{2 (d - x)}{(d - c) (d + c - a - b)} &\quad\text{for $c \le x \le d$}\\\\ 0 &\quad\text{for $d < x$} \\\\ \end{cases},$
 *
 * where $a, b, c, d \in \mathbb{R}$, $a < d$, $a \le b < c$ and $c \le d$. Support: $x \in \[a, d\]$.
 *
 * Cumulative distribution function:
 *
 * $F(x; a, b, c, d) = \begin{cases} \dfrac{(x-a)^2}{(b-a)(d+c-a-b)} & a \le x < b \\[4pt] \dfrac{2x-a-b}{d+c-a-b} & b \le x < c \\[4pt] 1 - \dfrac{(d-x)^2}{(d-c)(d+c-a-b)} & c \le x \le d \end{cases}$
 *
 * @class Trapezoidal
 * @memberof ran.dist
 * @constructor
 */
export default class Trapezoidal extends Distribution {
  /**
   * @param {number} a Lower bound of the support.
   * @param {number} b Start of the level part.
   * @param {number} c End of the level part.
   * @param {number} d Upper bound of the support.
   */
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

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    const { a, b, c, d } = this.p
    const h = this.c.scale
    return (d * d + d * c + c * c - a * a - a * b - b * b) / (3 * h)
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const { a, b, c, d } = this.p
    const h = this.c.scale
    const mu = this.mean()
    const e2 = ((d * d + c * c) * (d + c) - (a * a + b * b) * (a + b)) / (6 * h)
    return e2 - mu * mu
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const { a, b, c, d } = this.p
    const h = this.c.scale
    const mu = this.mean()
    const sigma2 = this.variance()
    const e2 = ((d * d + c * c) * (d + c) - (a * a + b * b) * (a + b)) / (6 * h)
    const e3 = (d * d * d * d + d * d * d * c + d * d * c * c + d * c * c * c + c * c * c * c -
      (a * a * a * a + a * a * a * b + a * a * b * b + a * b * b * b + b * b * b * b)) / (10 * h)
    const mu3 = e3 - 3 * mu * e2 + 2 * mu * mu * mu
    return mu3 / Math.pow(sigma2, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const { a, b, c, d } = this.p
    const h = this.c.scale
    const mu = this.mean()
    const sigma2 = this.variance()
    const e2 = ((d * d + c * c) * (d + c) - (a * a + b * b) * (a + b)) / (6 * h)
    const e3 = (d * d * d * d + d * d * d * c + d * d * c * c + d * c * c * c + c * c * c * c -
      (a * a * a * a + a * a * a * b + a * a * b * b + a * b * b * b + b * b * b * b)) / (10 * h)
    const e4 = (d * d * d * d * d + d * d * d * d * c + d * d * d * c * c + d * d * c * c * c + d * c * c * c * c + c * c * c * c * c -
      (a * a * a * a * a + a * a * a * a * b + a * a * a * b * b + a * a * b * b * b + a * b * b * b * b + b * b * b * b * b)) / (15 * h)
    const mu4 = e4 - 4 * mu * e3 + 6 * mu * mu * e2 - 3 * mu * mu * mu * mu
    return mu4 / (sigma2 * sigma2) - 3
  }

  static _fitInit (data) {
    // Endpoints from sample extremes; flat-region boundaries from quartiles as a balanced initial simplex
    const sorted = [...data].sort((x, y) => x - y)
    const lo = sorted[0]
    const hi = sorted[sorted.length - 1]
    const eps = (hi - lo) * 0.01 || 1e-6
    const q1 = sorted[Math.floor(sorted.length * 0.25)]
    const q3 = Math.max(sorted[Math.floor(sorted.length * 0.75)], q1 + eps)
    return [lo - eps, q1, q3, hi + eps]
  }
}
