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
 * @param {number=} xmin Lower boundary. Default value is 0.
 * @param {number=} xmax Upper boundary. Default value is 100.
 * @constructor
 */
export default class extends Distribution {
  constructor (xmin = 0, xmax = 100) {
    super('discrete', arguments.length)
    this.p = { xmin: Math.round(xmin), xmax: Math.round(xmax) }
    this.s = [{
      value: this.p.xmin,
      closed: true
    }, {
      value: this.p.xmax,
      closed: true
    }]
    this.c = [this.p.xmax - this.p.xmin + 1]
  }

  _generator () {
    // Direct sampling
    return Math.floor(this.r.next() * this.c[0]) + this.p.xmin
  }

  _pdf () {
    return 1 / this.c[0]
  }

  _cdf (x) {
    return (1 + x - this.p.xmin) / this.c[0]
  }
}
