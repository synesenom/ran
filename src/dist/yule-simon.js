import beta from '../special/beta'
import Distribution from './_distribution'

/**
 * Generator for the [Yule-Simon distribution]{@link https://en.wikipedia.org/wiki/Yule%E2%80%93Simon_distribution}:
 *
 * $$f(k; \rho) = \rho \mathrm{B}(k, \rho + 1),$$
 *
 * with \(\rho > 0\) and \(\mathrm{B}(x, y)\) is the beta function. Support: \(k \in \mathbb{N}^+\).
 *
 * @class YuleSimon
 * @memberOf ran.dist
 * @param {number=} rho Shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (rho = 2) {
    super('discrete', arguments.length)

    // Validate parameters
    this.p = { rho }
    this._validate({ rho }, [
      'rho > 0'
    ])

    // Set support
    this.s = [{
      value: 1,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    this.c = [
      this.p.rho + 1
    ]
  }

  _generator () {
    // Direct sampling by compounding exponential and geometric
    let e1 = -Math.log(this.r.next())
    let e2 = -Math.log(this.r.next())
    let z = Math.exp(-e2 / this.p.rho)

    // Handle z << 1 case
    return 1 - z === 1
      ? Math.ceil(e1 / z)
      : Math.ceil(-e1 / Math.log(1 - z))
  }

  _pdf (x) {
    return this.p.rho * beta(x, this.c[0])
  }

  _cdf (x) {
    return 1 - x * beta(x, this.c[0])
  }
}
