import Distribution from './_distribution'

/**
 * Generator for the [Pareto distribution]{@link https://en.wikipedia.org/wiki/Pareto_distribution}:
 *
 * $$f(x; x_\mathrm{min}, \alpha) = \frac{\alpha x_\mathrm{min}^\alpha}{x^{\alpha + 1}},$$
 *
 * with \(x_\mathrm{min}, \alpha > 0\). Support: \(x \in [x_\mathrm{min}, \infty)\).
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

    // Validate parameters
    this.p = { xmin, alpha }
    Distribution.validate({ xmin, alpha }, [
      'xmin > 0',
      'alpha > 0'
    ])

    // Set support
    this.s = [{
      value: xmin,
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
    return this.p.alpha * Math.pow(this.p.xmin / x, this.p.alpha) / x
  }

  _cdf (x) {
    return 1 - Math.pow(this.p.xmin / x, this.p.alpha)
  }

  _q (p) {
    return this.p.xmin / Math.pow(1 - p, 1 / this.p.alpha)
  }
}
