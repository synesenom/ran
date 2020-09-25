import IrwinHall from './irwin-hall'
import Distribution from './_distribution'

/**
 * Generator for the [Bates distribution]{@link https://en.wikipedia.org/wiki/Bates_distribution}:
 *
 * $$f(x; n, a, b) = \frac{n}{(b - a)(n - 1)!} \sum_{k = 0}^{\lfloor nz \rfloor} (-1)^k \begin{pmatrix}n \\\\ k \\\\ \end{pmatrix} (nz - k)^{n - 1},$$
 *
 * with $z = \frac{x - a}{b - a}$, $n \in \mathbb{N}^+$ and $a, b \in \mathbb{R}, a < b$.
 * Support: $x \in \[a, b\]$.
 *
 * @class Bates
 * @memberof ran.dist
 * @param {number=} n Number of uniform variates to sum. If not an integer, it is rounded to the nearest one. Default value is 10.
 * @param {number=} a Lower boundary of the uniform variate. Default value is 0.
 * @param {number=} b Upper boundary of the uniform variate. Default value is 1.
 * @constructor
 */
export default class extends IrwinHall {
  // Transformation of Irwin-Hall
  constructor (n = 3, a = 0, b = 1) {
    const ni = Math.round(n)
    super(ni)

    // Validate parameters
    this.p = Object.assign(this.p, { a, b })
    Distribution.validate({ a, b, n: ni }, [
      'n > 0',
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

    // Extend speed-up constants. Note that c in IrwinHall has a length of n + 1
    this.c = this.c.concat([
      n / (b - a),
      n * a / (b - a)
    ])
  }

  _generator () {
    // Direct sampling by transforming Irwin-Hall variate
    return super._generator() / this.c[this.p.n + 1] + this.p.a
  }

  _pdf (x) {
    return this.c[this.p.n + 1] * super._pdf(this.c[this.p.n + 1] * x - this.c[this.p.n + 2])
  }

  _cdf (x) {
    return super._cdf(this.c[this.p.n + 1] * x - this.c[this.p.n + 2])
  }
}
