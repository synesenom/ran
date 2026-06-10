import Distribution from './_distribution'

/**
 * Probability density function for the asymmetric [triangular distribution]{@link https://en.wikipedia.org/wiki/Triangular_distribution}:
 *
 * $f(x; a, b, c) = \begin{cases}0 &\quad\text{for $x < a$},\\\\ \frac{2 (x - a)}{(b - a) (c - a)} &\quad\text{for $a \le x < c$} \\\\ \frac{2 (b - x)}{(b - a) (b - c)} &\quad\text{for $c \le x \le b$} \\\\ 0 &\quad\text{for $b < x$} \\\\ \end{cases},$
 *
 * with $a, b, c \in \mathbb{R}$, $a < b$ and $a \le c \le b$. Support: $x \in \[a, b\]$.
 *
 * @class Triangular
 * @memberof ran.dist
 * @constructor
 */
export default class Triangular extends Distribution {
  /**
   * @param {number} a Lower bound of the support.
   * @param {number} b Upper bound of the support.
   * @param {number} c Mode of the distribution.
   */
  constructor (a, b, c) {
    super('continuous', 3)

    // Validate parameters
    this.p = { a, b, c }
    Distribution.validate({ a, b, c }, [
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

    // Speed-up constants
    const ba = b - a
    const bc = b - c
    const ca = c - a
    this.c = {
      ba,
      bc,
      ca,
      baBc: ba * bc,
      baCa: ba * ca
    }
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return x < this.p.c
      ? 2 * (x - this.p.a) / this.c.baCa
      : 2 * (this.p.b - x) / this.c.baBc
  }

  _cdf (x) {
    return x < this.p.c
      ? Math.pow(x - this.p.a, 2) / this.c.baCa
      : 1 - Math.pow(this.p.b - x, 2) / this.c.baBc
  }

  _q (p) {
    return p < this.c.ca / this.c.ba
      ? this.p.a + Math.sqrt(p * this.c.baCa)
      : this.p.b - Math.sqrt((1 - p) * this.c.baBc)
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return (this.p.a + this.p.b + this.p.c) / 3
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const { a, b, c } = this.p
    return (a * a + b * b + c * c - a * b - a * c - b * c) / 18
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const { a, b, c } = this.p
    const v = a * a + b * b + c * c - a * b - a * c - b * c
    return Math.SQRT2 * (a + b - 2 * c) * (2 * a - b - c) * (a - 2 * b + c) / (5 * v * Math.sqrt(v))
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    return -0.6
  }

  static _fitInit (data) {
    // Endpoints from sample extremes; mode via method-of-moments: E[X] = (a+b+c)/3 → c = 3μ̂ - a - b
    const n = data.length
    const lo = Math.min(...data)
    const hi = Math.max(...data)
    const eps = (hi - lo) * 0.01 || 1e-6
    const a = lo - eps
    const b = hi + eps
    const mean = data.reduce((s, x) => s + x, 0) / n
    const c = Math.max(a, Math.min(b, 3 * mean - a - b))
    return [a, b, c]
  }
}
