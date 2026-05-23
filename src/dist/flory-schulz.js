import Distribution from './_distribution'

/**
 * Generator for the [Flory-Schulz distribution]{@link https://en.wikipedia.org/wiki/Flory%E2%80%93Schulz_distribution}:
 *
 * $$f(k; a) = a^2 k (1 - a)^{k - 1},$$
 *
 * with $a \in (0, 1)$. Support: $k \in \mathbb{N}^+$.
 *
 * @class FlorySchulz
 * @memberof ran.dist
 * @param {number=} a Shape parameter. Default value is 0.5.
 * @see https://en.wikipedia.org/wiki/Flory%E2%80%93Schulz_distribution
 * @constructor
 */
export default class extends Distribution {
  constructor (a) {
    super('discrete', 1)

    // Validate parameters
    this.p = { a }
    Distribution.validate({ a }, [
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
    this.c = {
      oneMinusA: 1 - a,
      lnOneMinusA: Math.log1p(-a)
    }
  }

  _generator () {
    let k = 1
    const r = this.r.next()
    let ak = 1 + this.p.a
    let p = this.c.oneMinusA
    while (r < p * ak) {
      ak += this.p.a
      p *= this.c.oneMinusA
      k++
    }
    return k
  }

  _pdf (x) {
    return this.p.a * this.p.a * x * Math.pow(this.c.oneMinusA, x - 1)
  }

  _cdf (x) {
    // log1p/expm1 avoids 1-near-1 cancellation in 1-(1-a)^k*(1+ka) when a→0
    const kLnOma = x * this.c.lnOneMinusA
    return -Math.expm1(kLnOma) - Math.exp(kLnOma) * x * this.p.a
  }
}
