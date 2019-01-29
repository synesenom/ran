import { sum, neumaier } from '../utils'
import { gammaLn } from '../special'
import Distribution from './_distribution'

/**
 * Generator for the [Irwin-Hall distribution]{@link https://en.wikipedia.org/wiki/Irwin%E2%80%93Hall_distribution}:
 *
 * $$f(x; n) = \frac{1}{(n - 1)!} \sum_{k = 0}^{\lfloor x\rfloor} (-1)^k \begin{pmatrix}n \\ k \\ \end{pmatrix} (x - k)^{n - 1},$$
 *
 * with \(n \in \mathbb{N}_0\). Support: \(x \in [0, n]\).
 *
 * @class IrwinHall
 * @memberOf ran.dist
 * @param {number=} n Number of uniform variates to sum. Default value is 1.
 * @constructor
 */
// TODO improve summation in pdf/cdf
export default class extends Distribution {
  constructor (n = 1) {
    super('continuous', arguments.length)
    this.p = { n: Math.round(n) }
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: n,
      closed: true
    }]
    this.c = Array.from({ length: n + 1 }, (d, k) => gammaLn(k + 1) + gammaLn(n - k + 1))
  }

  _generator () {
    // Direct sampling
    return sum(Array.from({ length: this.p.n }, Math.random))
  }

  _pdf (x) {
    return neumaier(Array.from({ length: Math.floor(x) + 1 }, (d, k) => {
      let z = (this.p.n - 1) * Math.log(x - k) + Math.log(this.p.n) - this.c[k]

      let s = k % 2 === 0 ? 1 : -1
      return s * Math.exp(z)
    }))
  }

  _cdf (x) {
    return neumaier(Array.from({ length: Math.floor(x) + 1 }, (d, k) => {
      let z = this.p.n * Math.log(x - k) - this.c[k]

      let s = k % 2 === 0 ? 1 : -1
      return s * Math.exp(z)
    }))
  }
}
