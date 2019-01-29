import Distribution from './_distribution'

/**
 * Generator for the [Pareto distribution]{@link https://en.wikipedia.org/wiki/Pareto_distribution}:
 *
 * $$f(x; x_\mathrm{min}, \alpha) = \frac{\alpha x_\mathrm{min}^\alpha}{x^{\alpha + 1}},$$
 *
 * with \(x_\mathrm{min}, \alpha \in \mathbb{R}^+\). Support: \(x \in [x_\mathrm{min}, \infty)\).
 *
 * @class Pareto
 * @memberOf ran.dist
 * @param {number=} xmin Scale parameter. Default value is 1.
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (xmin = 1, alpha = 1) {
    super('continuous', arguments.length)
    this.p = { xmin, alpha }
    this.s = [{
      value: xmin,
      closed: true
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    return this.p.xmin / Math.pow(Math.random(), 1 / this.p.alpha)
  }

  _pdf (x) {
    return this.p.alpha * Math.pow(this.p.xmin / x, this.p.alpha) / x
  }

  _cdf (x) {
    return 1 - Math.pow(this.p.xmin / x, this.p.alpha)
  }
}
