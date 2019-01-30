import { gammaLn, gammaLowerIncomplete } from '../special'
import Distribution from './_distribution'

/**
 * Generator for the [Poisson distribution]{@link https://en.wikipedia.org/wiki/Poisson_distribution}:
 *
 * $$f(k; \lambda) = \frac{\lambda^k e^{-\lambda}}{k!},$$
 *
 * with \(\lambda \in \mathbb{R}^+\). Support: \(k \in \mathbb{N}_0\).
 *
 * @class Poisson
 * @memberOf ran.dist
 * @param {number=} lambda Mean of the distribution. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (lambda = 1) {
    super('discrete', arguments.length)
    this.p = { lambda }
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling
    if (this.p.lambda < 30) {
      // Small lambda, Knuth's method
      let l = Math.exp(-this.p.lambda)

      let k = 0

      let p = 1
      do {
        k++
        p *= Math.random()
      } while (p > l)
      return k - 1
    } else {
      // Large lambda, normal approximation
      let c = 0.767 - 3.36 / this.p.lambda

      let beta = Math.PI / Math.sqrt(3 * this.p.lambda)

      let alpha = beta * this.p.lambda

      let k = Math.log(c) - this.p.lambda - Math.log(beta)

      // Max 1000 trials
      for (let trials = 0; trials < 1000; trials++) {
        let r, x, n
        do {
          r = Math.random()
          x = (alpha - Math.log((1 - r) / r)) / beta
          n = Math.floor(x + 0.5)
        } while (n < 0)
        let v = Math.random()

        let y = alpha - beta * x

        let lhs = y + Math.log(v / Math.pow(1.0 + Math.exp(y), 2))

        let rhs = k + n * Math.log(this.p.lambda) - gammaLn(n + 1)
        if (lhs <= rhs) { return n }
      }
    }
  }

  _pdf (x) {
    return Math.pow(this.p.lambda, x) * Math.exp(-this.p.lambda - gammaLn(x + 1))
  }

  _cdf (x) {
    return 1 - gammaLowerIncomplete(x + 1, this.p.lambda)
  }
}
