import { sum, neumaier } from '../utils'
import { gammaLn } from '../special'
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
    this.c = Array.from({ length: this.p.n + 1 }, (d, k) => gammaLn(k + 1) + gammaLn(this.p.n - k + 1))
  }

  _generator () {
    // Direct sampling
    return (this.p.b - this.p.a) * sum(Array.from({ length: this.p.n }, Math.random)) / this.p.n + this.p.a
  }

  _pdf (x) {
    // Scaling the Irwin-Hall PDF
    // Use symmetry property for large x values
    let y = (x - this.p.a) / (this.p.b - this.p.a)
    y = this.p.n * (y < 0.5 ? y : 1 - y)

    // Compute terms
    let terms = Array.from({ length: Math.floor(y) + 1 }, (d, k) => {
      let z = (this.p.n - 1) * Math.log(y - k) - this.c[k]

      return k % 2 === 0 ? Math.exp(z) : -Math.exp(z)
    })

    // Sort terms
    terms.sort((a, b) => Math.abs(a) - Math.abs(b))

    // Calculate sum
    return this.p.n * this.p.n * neumaier(terms) / (this.p.b - this.p.a)
  }

  _cdf (x) {
    // Scaling the Irwin-Hall CDF
    // Use symmetry property for large x values
    let y = (x - this.p.a) / (this.p.b - this.p.a)
    let t = this.p.n * (y < 0.5 ? y : 1 - y)

    // Compute terms
    let terms = Array.from({ length: Math.floor(t) + 1 }, (d, k) => {
      let z = this.p.n * Math.log(t - k) - this.c[k]

      return k % 2 === 0 ? Math.exp(z) : -Math.exp(z)
    })

    // Sort terms
    terms.sort((a, b) => Math.abs(a) - Math.abs(b))

    // Calculate sum
    return y < 0.5 ? neumaier(terms) : 1 - neumaier(terms)
  }
}
