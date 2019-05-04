import Distribution from './_distribution'
import brent from '../algorithms/brent'

/**
 * Generator for the [Tukey lambda distribution]{@link https://en.wikipedia.org/wiki/Tukey_lambda_distribution}:
 *
 * $$f(x; \lambda) = \frac{1}{Q^{-1}(F(x))},$$
 *
 * where \(Q(p) = \frac{p^\lambda - (1 - p)^\lambda}{\lambda}\) and \(F(x) = Q^{-1}(x)\). Support: \(x \in [-1/\lambda, 1/\lambda]\) if \(\lambda > 0\), otherwise \(x \in \mathbb{R}\).
 *
 * @class TukeyLambda
 * @memberOf ran.dist
 * @param {number=} lambda Shape parameter. Default value is 1.5.
 * @constructor
 */
export default class extends Distribution {
  constructor (lambda = 1.5) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = {lambda}

    // Set support
    this.s = [{
      value: lambda > 0 ? -1 / lambda : -Infinity,
      closed: lambda > 0
    }, {
      value: lambda > 0 ? 1 / lambda : Infinity,
      closed: lambda > 0
    }]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    if (this.p.lambda === 0) {
      let y = Math.exp(-x)
      return y / Math.pow(1 + y, 2)
    } else {
      if (x === 0) {
        return Math.pow(2, this.p.lambda) / 4
      } else {
        // f(x) = Q^(-1)[F(x)]
        let z = this._cdf(x)
        return 1 / (Math.pow(z, this.p.lambda - 1) + Math.pow(1 - z, this.p.lambda - 1))
      }
    }
  }

  _cdf (x) {
    // If lambda != 0, F(x) is the inverse of quantile function
    return this.p.lambda === 0
      ? 1 / (1 + Math.exp(-x))
      : brent(
        t => (Math.pow(t, this.p.lambda) - Math.pow(1 - t, this.p.lambda)) / this.p.lambda - x,
        0, 1
      )
  }

  _q (p) {
    return this.p.lambda === 0
      ? Math.log(p / (1 - p))
      : (Math.pow(p, this.p.lambda) - Math.pow(1 - p, this.p.lambda)) / this.p.lambda
  }
}
