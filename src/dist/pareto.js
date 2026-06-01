import Distribution from './_distribution'

/**
 * Probability density function for the [Pareto distribution]{@link https://en.wikipedia.org/wiki/Pareto_distribution}:
 *
 * $f(x; x_\mathrm{min}, \alpha) = \frac{\alpha x_\mathrm{min}^\alpha}{x^{\alpha + 1}},$
 *
 * with $x_\mathrm{min}, \alpha > 0$. Support: $x \in [x_\mathrm{min}, \infty)$.
 *
 * @class Pareto
 * @memberof ran.dist
 * @constructor
 */
export default class Pareto extends Distribution {
  /**
   * @param {number} xmin Scale parameter.
   * @param {number} alpha Shape parameter.
   */
  constructor (xmin, alpha) {
    super('continuous', 2)

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
    // -expm1(-alpha * log(x/xmin)) avoids cancellation when x is near xmin
    return -Math.expm1(-this.p.alpha * Math.log(x / this.p.xmin))
  }

  _q (p) {
    return this.p.xmin / Math.pow(1 - p, 1 / this.p.alpha)
  }

  static get _fitInitIsExact () {
    // _fitInit returns the exact closed-form MLE, so fit() skips the optimizer (ADR-0016).
    return true
  }

  static _fitInit (data) {
    const xmin = Math.min(...data)
    const n = data.length
    const alpha = n / data.reduce((s, x) => s + Math.log(x / xmin), 0)
    return [xmin, alpha]
  }
}
