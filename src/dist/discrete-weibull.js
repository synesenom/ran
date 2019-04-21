import Distribution from './_distribution'

/**
 * Generator for the [discrete Weibull distribution]{@link https://en.wikipedia.org/wiki/Discrete_Weibull_distribution} (using the original parametrization):
 *
 * $$f(k; q, \beta) = q^{k^\beta} - q^{(k + 1)^\beta},$$
 *
 * with \(q \in (0, 1)\) and \(\beta \in \mathbb{R}^+\). Support: \(k \in \mathbb{N}_0\).
 *
 * @class DiscreteWeibull
 * @memberOf ran.dist
 * @param {number=} q First shape parameter. Default value is 0.5.
 * @param {number=} beta Second shape parameter. Default value is 0.5.
 * @constructor
 */
export default class extends Distribution {
  constructor (q = 0.5, beta = 1) {
    super('discrete', arguments.length)
    this.p = { q, beta }
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
    return Math.floor(Math.pow(Math.log(this.r.next()) / Math.log(this.p.q), 1 / this.p.beta))
  }

  _pdf (x) {
    return Math.pow(this.p.q, Math.pow(x, this.p.beta)) - Math.pow(this.p.q, Math.pow(x + 1, this.p.beta))
  }

  _cdf (x) {
    return 1 - Math.pow(this.p.q, Math.pow(x + 1, this.p.beta))
  }

  _q (p) {
    return Math.floor(Math.pow(Math.log(1 - p) / Math.log(this.p.q), 1 / this.p.beta))
  }
}
