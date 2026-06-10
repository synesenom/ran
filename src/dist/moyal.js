import Distribution from './_distribution'
import { gammaUpperIncomplete, erfinv } from '../special'

/**
 * Probability density function for the [Moyal distribution]{@link https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.moyal.html#r7049b665a02e-2}:
 *
 * $f(x; \mu, \sigma) = \frac{1}{\sqrt{2 \pi}}e^{-\frac{1}{2}(z + e^{-z})},$
 *
 * where $z = \frac{x - \mu}{\sigma}$, $\mu \in \mathbb{R}$ and $\sigma > 0$. Support: $x \in \mathbb{R}$.
 *
 * Cumulative distribution function:
 *
 * $F(x; \mu, \sigma) = \operatorname{erfc}\left(\frac{1}{\sqrt{2}} e^{-(x-\mu)/(2\sigma)}\right)$
 *
 * @class Moyal
 * @memberof ran.dist
 * @constructor
 */
export default class Moyal extends Distribution {
  /**
   * @param {number} mu Location parameter.
   * @param {number} sigma Scale parameter.
   */
  constructor (mu, sigma) {
    super('continuous', 2)

    // Validate parameters
    this.p = { mu, sigma }
    Distribution.validate({ mu, sigma }, [
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
    this.c = {
      sigmaRoot2Pi: sigma * Math.sqrt(2 * Math.PI)
    }
  }

  _generator () {
    // Inverse transform sampling: q(u) for u ~ U(0,1).
    return this._q(this.r.next())
  }

  _pdf (x) {
    const z = (x - this.p.mu) / this.p.sigma
    return Math.exp(-0.5 * (z + Math.exp(-z))) / this.c.sigmaRoot2Pi
  }

  _cdf (x) {
    // gammaUpperIncomplete avoids catastrophic cancellation when x << mu (large z, Q near zero)
    return gammaUpperIncomplete(0.5, 0.5 * Math.exp((this.p.mu - x) / this.p.sigma))
  }

  _q (p) {
    // Same closed-form inversion as _generator: erfc(.) = p => erfcinv(p) = erfinv(1 - p)
    return this.p.mu - 2 * this.p.sigma * Math.log(Math.SQRT2 * erfinv(1 - p))
  }

  static _fitInit (data) {
    // Var[X] = pi^2 sigma^2 / 2 and mean = mu + sigma*(ln2 + gamma_EM) link sample moments to parameters
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const v = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n
    const sigma = Math.max(Math.sqrt(2 * v) / Math.PI, 1e-3)
    return [mean - sigma * (Math.LN2 + 0.5772156649015329), sigma]
  }
}
