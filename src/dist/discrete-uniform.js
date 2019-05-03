import Distribution from './_distribution'

/**
 * Generator for the discrete
 * [uniform distribution]{@link https://en.wikipedia.org/wiki/Discrete_uniform_distribution}:
 *
 * $$f(k; x_\mathrm{min}, x_\mathrm{max}) = \frac{1}{x_\mathrm{max} - x_\mathrm{min} + 1},$$
 *
 * with \(x_\mathrm{min}, x_\mathrm{max} \in \mathbb{Z}\) and \(x_\mathrm{min} < x_\mathrm{max}\). Support: \(k \in \{x_\mathrm{min}, ..., x_\mathrm{max}\}\).
 *
 * @class DiscreteUniform
 * @memberOf ran.dist
 * @param {number=} xmin Lower boundary. If not an integer, it is rounded to the nearest one. Default value is 0.
 * @param {number=} xmax Upper boundary. If not an integer, it is rounded to the nearest one. Default value is 100.
 * @constructor
 */
export default class extends Distribution {
  constructor (xmin = 0, xmax = 100) {
    super('discrete', arguments.length)

    // Validate parameters
    let xmini = Math.round(xmin)
    let xmaxi = Math.round(xmax)
    this.p = { xmin: xmini, xmax: xmaxi }
    Distribution._validate({ xmin: xmini, xmax: xmaxi }, [
      'xmin < xmax'
    ])

    // Set support
    this.s = [{
      value: this.p.xmin,
      closed: true
    }, {
      value: this.p.xmax,
      closed: true
    }]

    // Speed-up constants
    this.c = [
      this.p.xmax - this.p.xmin + 1
    ]
  }

  _generator () {
    // Direct sampling
    return this._q(this.r.next())
  }

  _pdf () {
    return 1 / this.c[0]
  }

  _cdf (x) {
    return (1 + x - this.p.xmin) / this.c[0]
  }

  _q (p) {
    return Math.floor(p * this.c[0]) + this.p.xmin
  }
}
