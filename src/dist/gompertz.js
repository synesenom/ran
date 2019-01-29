import Distribution from './_distribution'

/**
 * Generator for the [Gompertz distribution]{@link https://en.wikipedia.org/wiki/Gompertz_distribution}:
 *
 * $$f(x; \eta, b) = b \eta e^{\eta + bx - \eta e^{bx}} ,$$
 *
 * with \(\eta, b \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+ \cup \{0\}\).
 *
 * @class Gompertz
 * @memberOf ran.dist
 * @param {number=} eta Shape parameter. Default value is 1.
 * @param {number=} beta Scale parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (eta = 1, b = 1) {
    super('continuous', arguments.length)
    this.p = { eta, b }
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    return Math.log(1 - Math.log(Math.random()) / this.p.eta) / this.p.b
  }

  _pdf (x) {
    return this.p.b * this.p.eta * Math.exp(this.p.eta + this.p.b * x - this.p.eta * Math.exp(this.p.b * x))
  }

  _cdf (x) {
    return 1 - Math.exp(-this.p.eta * (Math.exp(this.p.b * x) - 1))
  }
}
