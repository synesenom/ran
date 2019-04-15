import Distribution from './_distribution'

/**
 * Generator for the [geometric distribution]{@link https://en.wikipedia.org/wiki/Geometric_distribution} (the number of
 * failures before the first success definition):
 *
 * $$f(k; p) = p (1 - p)^k,$$
 *
 * with \(p \in (0, 1]\). Support: \(k \in \{0, 1, 2, ...\}\).
 *
 * @class Geometric
 * @memberOf ran.dist
 * @param {number} p Probability of success. Default value is 0.5.
 * @constructor
 */
export default class extends Distribution {
  constructor (p = 0.5) {
    super('discrete', arguments.length)
    this.p = { p }
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    return Math.floor(Math.log(this.r.next()) / Math.log(1 - this.p.p))
  }

  _pdf (x) {
    return this.p.p * Math.pow(1 - this.p.p, x)
  }

  _cdf (x) {
    return 1 - Math.pow(1 - this.p.p, x + 1)
  }
}
