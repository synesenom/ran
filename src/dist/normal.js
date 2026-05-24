import { erf, erfinv } from '../special'
import normal from './_normal'
import Distribution from './_distribution'

/**
 * Generator for the [normal distribution]{@link https://en.wikipedia.org/wiki/Normal_distribution}:
 *
 * $f(x; \mu, \sigma) = \frac{1}{\sqrt{2 \pi \sigma^2}} e^{-\frac{(x - \mu)^2}{2\sigma^2}},$
 *
 * with $\mu \in \mathbb{R}$ and $\sigma > 0$. Support: $x \in \mathbb{R}$.
 *
 * @class Normal
 * @memberof ran.dist
 * @see https://en.wikipedia.org/wiki/Normal_distribution
 * @see https://en.wikipedia.org/wiki/Ziggurat_algorithm Improved Ziggurat algorithm (sampling algorithm)
 * @constructor
 */
export default class Normal extends Distribution {
  /**
   * @param {number} mu Location parameter (mean).
   * @param {number} sigma Squared scale parameter (variance).
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
      sigmaRoot2Pi: sigma * Math.sqrt(2 * Math.PI),
      sigmaRoot2: sigma * Math.SQRT2
    }
  }

  _generator () {
    // Direct sampling
    return normal(this.r, this.p.mu, this.p.sigma)
  }

  _pdf (x) {
    return Math.exp(-0.5 * Math.pow((x - this.p.mu) / this.p.sigma, 2)) / this.c.sigmaRoot2Pi
  }

  _cdf (x) {
    return 0.5 * (1 + erf((x - this.p.mu) / this.c.sigmaRoot2))
  }

  _q (p) {
    return this.p.mu + this.c.sigmaRoot2 * erfinv(2 * p - 1)
  }
}
