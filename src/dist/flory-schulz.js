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

    // Validate parameters
    this.p = { a }
    Distribution._validate({ a }, [
      'a > 0', 'a < 1'
    ])

    // Set support
    this.s = [{
      value: 1,
      closed: true
    }, {
      value: Infinity,
      closed: true
    }]

    // Speed-up constants
    this.c = [
      1 - a
    ]
  }

  _generator () {
    // Inverse transform sampling
    let k = 1
    let r = this.r.next()
    let ak = 1 + this.p.a
    let p = this.c[0]
    while (r < p * ak) {
      ak += this.p.a
      p *= this.c[0]
      k++
    }
    return k
  }

  _pdf (x) {
    return this.p.a * this.p.a * x * Math.pow(this.c[0], x - 1)
  }

  _cdf (x) {
    return 1 - Math.pow(this.c[0], x) * (1 + this.p.a * x)
  }
}
