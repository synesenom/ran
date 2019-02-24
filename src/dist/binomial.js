import binomLn from '../special/binom-log'
import gammaLn from '../special/gamma-log'
import { regularizedBetaIncomplete } from '../special/beta-incomplete'
import Distribution from './_distribution'

/**
 * Generator for the [binomial distribution]{@link https://en.wikipedia.org/wiki/Binomial_distribution}:
 *
 * $$f(k; n, p) = \begin{pmatrix}n \\ k \\ \end{pmatrix} p^k (1 - p)^{n - k},$$
 *
 * with \(n \in \mathbb{N}_0\) and \(p \in [0, 1]\). Support: \(k \in \{0, ..., n\}\).
 *
 * @class Binomial
 * @memberOf ran.dist
 * @param {number=} n Number of trials. Default value is 100.
 * @param {number=} p Probability of success. Default value is 0.5.
 * @constructor
 */
// TODO Use special case of custom instead
export default class extends Distribution {
  constructor (n = 100, p = 0.5) {
    super('discrete', arguments.length)
    let pp = p <= 0.5 ? p : 1 - p
    this.p = { n: Math.round(n), p }
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: this.p.n,
      closed: true
    }]
    this.c = [pp, this.p.n * pp]
  }

  _generator () {
    // Direct sampling
    if (this.p.n < 25) {
      // Small n
      let b = 0
      for (let i = 1; i <= this.p.n; i++) {
        if (Math.random() < this.c[0]) b++
      }
      return this.c[0] === this.p.p ? b : this.p.n - b
    } else if (this.c[1] < 1.0) {
      // Small mean
      let lambda = Math.exp(-this.c[1])

      let t = 1.0; let i
      for (i = 0; i <= this.p.n; i++) {
        t *= Math.random()
        if (t < lambda) break
      }
      let b = Math.min(i, this.p.n)
      return this.c[0] === this.p.p ? b : this.p.n - b
    } else {
      // Rest of the cases
      let en = this.p.n

      let g = gammaLn(en + 1)

      let pc = 1 - this.c[0]

      let pLog = Math.log(this.c[0])

      let pcLog = Math.log(pc)

      let sq = Math.sqrt(2.0 * this.c[1] * pc)

      let y; let em; let t
      do {
        do {
          y = Math.tan(Math.PI * Math.random())
          em = sq * y + this.c[1]
        } while (em < 0.0 || em >= (en + 1.0))
        em = Math.floor(em)
        t = 1.2 * sq * (1.0 + y * y) * Math.exp(g - gammaLn(em + 1.0) -
          gammaLn(en - em + 1.0) + em * pLog + (en - em) * pcLog)
      } while (Math.random() > t)
      return this.c[0] === this.p.p ? em : this.p.n - em
    }
  }

  _pdf (x) {
    return Math.exp(binomLn(this.p.n, x) +
      x * Math.log(this.p.p) + (this.p.n - x) * Math.log(1 - this.p.p))
  }

  _cdf (x) {
    return regularizedBetaIncomplete(this.p.n - x, 1 + x, 1 - this.p.p)
  }
}
