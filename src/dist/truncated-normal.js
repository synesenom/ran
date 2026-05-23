import Normal from './normal'
import Distribution from './_distribution'
import { erfinv } from '../special'

/**
 * Generator for the [truncated normal distribution]{@link https://en.wikipedia.org/wiki/Truncated_normal_distribution}:
 *
 * $f(x; \mu, \sigma, a, b) = \frac{\phi(\xi)}{\Phi(\beta) - \Phi(\alpha)},$
 *
 * where $\xi = \frac{x - \mu}{\sigma}, \alpha = \frac{a - \mu}{\sigma}$ and $\beta = \frac{b - \mu}{\sigma}$.
 * The functions $\phi$ and $\Phi$ denote the probability density and cumulative distribution functions of the normal
 * distribution. Finally, $\mu \in \mathbb{R}$, $\sigma > 0$ and $b > a$. Support: $x \in [a, b]$.
 *
 * @class TruncatedNormal
 * @memberof ran.dist
 * @see https://en.wikipedia.org/wiki/Truncated_normal_distribution
 * @constructor
 */
export default class TruncatedNormal extends Normal {
  /**
   * @param {number} mu Mean of the underlying normal distribution.
   * @param {number} sigma Variance of the underlying normal distribution.
   * @param {number} a Lower boundary of the support.
   * @param {number} b Upper boundary of the support.
   */
  constructor (mu, sigma, a, b) {
    // Call super and update number of parameters.
    super(mu, sigma)
    this.k = 4

    // Validate parameters.
    this.p = { mu, sigma, a, b }
    Distribution.validate({ mu, sigma, a, b }, [
      'sigma > 0',
      'b > a'
    ])

    // Set support.
    this.s = [{
      value: a,
      closed: true
    }, {
      value: b,
      closed: true
    }]

    // Speed-up constants — merge with parent Normal constants.
    Object.assign(this.c, {
      phiA: super._cdf(a),
      Z: super._cdf(b) - super._cdf(a)
    })
  }

  _generator () {
    return this._q(this.r.next())
  }

  _pdf (x) {
    return super._pdf(x) / this.c.Z
  }

  _cdf (x) {
    return (super._cdf(x) - this.c.phiA) / this.c.Z
  }

  _q (p) {
    return this.p.mu + this.c.sigmaRoot2 * erfinv(2 * (this.c.phiA + p * this.c.Z) - 1)
  }
}
