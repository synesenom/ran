import Distribution from './_distribution'

/**
 * Generator for the [geometric distribution]{@link https://en.wikipedia.org/wiki/Geometric_distribution} (the number of
 * failures before the first success definition):
 *
 * $$f(k; p) = p (1 - p)^k,$$
 *
 * with \(p \in (0, 1]\). Support: \(k \in \{0, 1, 2, ...\}\). Note that the [discrete exponential distribution]{@link https://docs.scipy.org/doc/scipy/reference/tutorial/stats/discrete_planck.html} is also a geometric distribution with rate parameter equal to \(-\ln(1 - p)\).
 *
 * @class Geometric
 * @memberOf ran.dist
 * @param {number} p Probability of success. Default value is 0.5.
 * @constructor
 */
export default class extends Distribution {
  constructor (p = 0.5) {
    super('discrete', arguments.length)

    // Validate parameters
    this.p = { p }
    Distribution._validate({ p }, [
      'p > 0', 'p <= 1'
    ])

    // Set support
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
    return this._q(this.r.next())
  }

  _pdf (x) {
    return this.p.p * Math.pow(1 - this.p.p, x)
  }

  _cdf (x) {
    return 1 - Math.pow(1 - this.p.p, x + 1)
  }

  _q (p) {
    return Math.floor(Math.log(1 - p) / Math.log(1 - this.p.p))
  }
}
