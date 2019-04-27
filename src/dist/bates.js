import IrwinHall from './irwin-hall'

/**
 * Generator for the [Bates distribution]{@link https://en.wikipedia.org/wiki/Bates_distribution}:
 *
 * $$f(x; n, a, b) = \frac{n}{(b - a)(n - 1)!} \sum_{k = 0}^{\lfloor nz \rfloor} (-1)^k \begin{pmatrix}n \\ k \\ \end{pmatrix} (nz - k)^{n - 1},$$
 *
 * with \(z = \frac{x - a}{b - a}\), \(n \in \mathbb{N}_0\) and \(a, b \in \mathbb{R}, a < b\). Support: \(x \in [a, b]\).
 *
 * @class Bates
 * @memberOf ran.dist
 * @param {number=} n Number of uniform variates to sum. Default value is 10.
 * @param {number=} a Lower boundary of the uniform variate. Default value is 0.
 * @param {number=} b Upper boundary of the uniform variate. Default value is 1.
 * @constructor
 */
export default class extends IrwinHall {
  // Transformation of Irwin-Hall
  constructor (n = 10, a = 0, b = 1) {
    super(n)
    this.p = Object.assign(this.p, { a, b })
    this.s = [{
      value: a,
      closed: true
    }, {
      value: b,
      closed: true
    }]
  }

  _generator () {
    // Direct sampling by transforming Irwin-Hall variate
    return (this.p.b - this.p.a) * super._generator() / this.p.n + this.p.a
  }

  _pdf (x) {
    return this.p.n * super._pdf(this.p.n * (x - this.p.a) / (this.p.b - this.p.a)) / (this.p.b - this.p.a)
  }

  _cdf (x) {
    return super._cdf(this.p.n * (x - this.p.a) / (this.p.b - this.p.a))
  }
}
