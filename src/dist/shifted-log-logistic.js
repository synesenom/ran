import Distribution from './_distribution'

/**
 * Generator for the [shifted log-logistic distribution]{@link https://en.wikipedia.org/wiki/Shifted_log-logistic_distribution}:
 *
 * $$f(x; \mu, s) = \frac{(1 + \xi z)^{-(1/\xi + 1)}}{\sigma [1 + (1 + \xi z)^{-1/\xi}]^2},$$
 *
 * with \(z = \frac{x - \mu}{\sigma}\), \(\mu, \xi \in \mathbb{R}\) and \(\sigma > 0\). Support: \(x \ge \mu - \sigma/\xi\) if \(\xi > 0\), \(x \le \mu - \sigma/\xi\) if \(\xi < 0\), \(x \in \mathbb{R}\) otherwise.
 *
 * @class ShiftedLogLogistic
 * @memberOf ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} sigma Scale parameter. Default value is 1.
 * @param {number=} xi Shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (mu = 0, sigma = 1, xi = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { mu, sigma, xi }
    Distribution._validate({ mu, sigma, xi }, [
      'sigma > 0'
    ])

    // Set support
    this.s = xi === 0 ? [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }] : [{
      value: xi > 0 ? mu - sigma / xi : -Infinity,
      closed: xi > 0
    }, {
      value: xi < 0 ? mu - sigma / xi : Infinity,
      closed: xi < 0
    }]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    if (this.p.xi === 0) {
      // Fall back to logistic
      const z = Math.exp(-(x - this.p.mu) / this.p.sigma)
      return isFinite(z * z)
        ? z / (this.p.sigma * Math.pow(1 + z, 2))
        : 0
    } else {
      const z = (x - this.p.mu) / this.p.sigma

      return Math.pow(1 + this.p.xi * z, -(1 / this.p.xi + 1)) / (this.p.sigma * Math.pow(1 + Math.pow(1 + this.p.xi * z, -1 / this.p.xi), 2))
    }
  }

  _cdf (x) {
    if (this.p.xi === 0) {
      // Fall back to logistic
      return 1 / (1 + Math.exp(-(x - this.p.mu) / this.p.sigma))
    } else {
      const z = (x - this.p.mu) / this.p.sigma
      const y = Math.pow(1 + this.p.xi * z, -1 / this.p.xi)
      return isFinite(y) ? 1 / (1 + y) : 0
    }
  }

  _q (p) {
    if (this.p.xi === 0) {
      // Fall back to logistic
      return this.p.mu - this.p.sigma * Math.log(1 / p - 1)
    } else {
      return this.p.mu + this.p.sigma * (Math.pow(1 / p - 1, -this.p.xi) - 1) / this.p.xi
    }
  }
}
