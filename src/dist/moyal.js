import { rejection } from './_core'
import Distribution from './_distribution'
import { gammaLowerIncomplete } from '../special/gamma-incomplete'

/**
 * Generator for the [Moyal distribution]{@link https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.moyal.html#r7049b665a02e-2}:
 *
 * $$f(x; \mu, \sigma) = \frac{1}{\sqrt{2 \pi}}e^{-\frac{1}{2}(z + e^{-z})},$$
 *
 * where \(z = \frac{x - \mu}{\sigma}\), \(\mu \in \mathbb{R}\) and \(\sigma > 0\). Support: \(x \in \mathbb{R}\).
 *
 * @class Moyal
 * @memberOf ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} sigma Scale parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (mu = 0, sigma = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { mu, sigma }
    Distribution._validate({ mu, sigma }, [
      'sigma > 0'
    ])

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    this.c = [
      sigma * Math.sqrt(2 * Math.PI)
    ]
  }

  _generator () {
    return rejection(
      this.r,
      () => Math.PI * this.r.next() - Math.PI / 2,
      t => {
        let z = Math.tan(t)
        return Math.exp(-0.5 * (z + Math.exp(-z))) / (Math.sqrt(2 * Math.PI) * Math.pow(Math.cos(t), 2))
      }, t => this.p.sigma * Math.tan(t) + this.p.mu
    )
  }

  _pdf (x) {
    let z = (x - this.p.mu) / this.p.sigma
    return Math.exp(-0.5 * (z + Math.exp(-z))) / this.c[0]
  }

  _cdf (x) {
    return 1 - gammaLowerIncomplete(0.5, 0.5 * Math.exp((this.p.mu - x) / this.p.sigma))
  }
}
