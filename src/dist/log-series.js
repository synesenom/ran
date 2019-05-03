import { betaIncomplete } from '../special/beta-incomplete'
import Distribution from './_distribution'

/**
 * Generator for the [log-series distribution]{@link }:
 *
 * $$f(k; p) = \frac{-1}{\ln(1 - p)}\frac{p^k}{k},$$
 *
 * with \(p \in (0, 1)\). Support: \(k \in \mathbb{N}^+\).
 *
 * @class LogSeries
 * @memberOf ran.dist
 * @param {number=} p Distribution parameter. Default value is 0.5.
 * @constructor
 */
export default class extends Distribution {
  constructor (p = 0.5) {
    super('discrete', arguments.length)

    // Validate parameters
    this.p = { p }
    Distribution._validate({ p }, [
      'p > 0', 'p < 1'
    ])

    // Set support
    this.s = [{
      value: 1,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling
    return Math.floor(1 + Math.log(this.r.next()) / Math.log(1 - Math.pow(1 - this.p.p, this.r.next())))
  }

  _pdf (x) {
    return -Math.pow(this.p.p, x) / (x * Math.log(1 - this.p.p))
  }

  _cdf (x) {
    return 1 + betaIncomplete(x + 1, 0, this.p.p) / Math.log(1 - this.p.p)
  }
}
