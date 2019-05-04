import Distribution from './_distribution'

/**
 * Generator for the [anglit distribution]{@link https://docs.scipy.org/doc/scipy-1.0.0/reference/tutorial/stats/continuous_anglit.html}:
 *
 * $$f(x) = \cos(2 x).$$
 *
 * Support: \(x \in [-\frac{\pi}{4}, \frac{\pi}{4}]\).
 *
 * @class Anglit
 * @memberOf ran.dist
 * @constructor
 */
export default class extends Distribution {
  constructor () {
    super('continuous', arguments.length)

    // Set support
    this.s = [{
      value: -Math.PI / 4,
      closed: true
    }, {
      value: Math.PI / 4,
      closed: true
    }]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return Math.cos(2 * x)
  }

  _cdf (x) {
    return Math.pow(Math.sin(x + Math.PI / 4), 2)
  }

  _q (p) {
    return Math.asin(Math.sqrt(p)) - Math.PI / 4
  }
}
