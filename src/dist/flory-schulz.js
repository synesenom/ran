import { zeta } from './_standard'
import Distribution from './_distribution'

/**
 * Generator for the [Flory-Schulz distribution]{@link https://en.wikipedia.org/wiki/Flory%E2%80%93Schulz_distribution}:
 *
 * $$f(k; a) = a^2 k (1 - a)^{k - 1},$$
 *
 * with \(a \in (0, 1)\). Support: \(k \in \mathbb{N}^+\).
 *
 * @class FlorySchulz
 * @memberOf ran.dist
 * @param {number=} a Shape parameter. Default value is 0.5.
 * @constructor
 */
export default class extends Distribution {
  constructor (a = 0.5) {
    super('discrete', arguments.length)
    this.p = { a }
    this.s = [{
      value: 1,
      closed: true
    }, {
      value: null,
      closed: true
    }]

    // Speed up constants for rejection sampling
    let s = 1.5
    let k = -(s + 1) / Math.log(1 - a)
    this.c = [
      s, k,
      Math.pow(k, -s - 1) / Math.pow(1 - a, k)
    ]
  }

  _generator () {
    // Rejection sampling with zeta distribution as major
    for (let trial = 0; trial < 1000; trial++) {
      let z = zeta(this.c[0])
      if (Math.random() < Math.pow(z, this.c[0] + 1) * Math.pow(1 - this.p.a, z) * this.c[2]) {
        return z
      }
    }

    return 1
  }

  _pdf (x) {
    return this.p.a * this.p.a * x * Math.pow(1 - this.p.a, x - 1)
  }

  _cdf (x) {
    return 1 - Math.pow(1 - this.p.a, x) * (1 + this.p.a * x)
  }
}
