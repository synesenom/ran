import { sum, neumaier } from '../utils'
import * as special from '../special'
import Distribution from './_distribution'

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
export default class extends Distribution {
  constructor (n = 10, a = 0, b = 1) {
    super('continuous', arguments.length)
    this.p = { n: Math.round(n), a, b }
    this.s = [{
      value: a,
      closed: true
    }, {
      value: b,
      closed: true
    }]
    this.c = Array.from({ length: this.p.n + 1 }, (d, k) => special.gammaLn(k + 1) + special.gammaLn(this.p.n - k + 1))
  }

  _generator () {
    // Direct sampling
    return sum(Array.from({ length: this.p.n }, () => (this.p.b - this.p.a) * Math.random() + this.p.a)) / this.p.n
  }

  _pdf (x) {
    let y = (x - this.p.a) / (this.p.b - this.p.a)

    let nx = this.p.n * y
    return this.p.n * neumaier(Array.from({ length: Math.floor(nx) + 1 }, (d, k) => {
      let z = (this.p.n - 1) * Math.log(nx - k) + Math.log(this.p.n) - this.c[k]

      let s = k % 2 === 0 ? 1 : -1
      return s * Math.exp(z)
    })) / (this.p.b - this.p.a)
  }

  _cdf (x) {
    let y = (x - this.p.a) / (this.p.b - this.p.a)

    let nx = this.p.n * y
    return neumaier(Array.from({ length: Math.floor(nx) + 1 }, (d, k) => {
      let z = this.p.n * Math.log(nx - k) - this.c[k]

      let s = k % 2 === 0 ? 1 : -1
      return s * Math.exp(z)
    }))
  }
}
