import Distribution from './_distribution'

/**
 * Generator for the [discrete Weibull distribution]{@link https://en.wikipedia.org/wiki/Discrete_Weibull_distribution} (using the original parametrization):
 *
 * $$f(k; q, \beta) = q^{k^\beta} - q^{(k + 1)^\beta},$$
 *
 * with $q \in (0, 1)$ and $\beta > 0$. Support: $k \in \mathbb{N}_0$.
 *
 * @class DiscreteWeibull
 * @memberof ran.dist
 * @param {number=} q First shape parameter. Default value is 0.5.
 * @param {number=} beta Second shape parameter. Default value is 1.
 * @see https://en.wikipedia.org/wiki/Discrete_Weibull_distribution
 * @constructor
 */
export default class extends Distribution {
  constructor (q, beta) {
    super('discrete', arguments.length)

    // Validate parameters
    this.p = { q, beta }
    Distribution.validate({ q, beta }, [
      'q > 0', 'q < 1',
      'beta > 0'
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
    return Math.pow(this.p.q, Math.pow(x, this.p.beta)) - Math.pow(this.p.q, Math.pow(x + 1, this.p.beta))
  }

  _cdf (x) {
    return 1 - Math.pow(this.p.q, Math.pow(x + 1, this.p.beta))
  }

  _q (p) {
    // ceil(x)-1 equals floor(x) for non-integer x but gives x-1 when x is exact,
    // preventing the off-by-one when CDF(k) = p exactly.
    return Math.ceil(Math.pow(Math.log(1 - p) / Math.log(this.p.q), 1 / this.p.beta)) - 1
  }
}
