import Distribution from './_distribution'

/**
 * Generator for the continuous
 * [uniform distribution]{@link https://en.wikipedia.org/wiki/Uniform_distribution_(continuous)}:
 *
 * $$f(x; x_\mathrm{min}, x_\mathrm{max}) = \frac{1}{x_\mathrm{max} - x_\mathrm{min}},$$
 *
 * with \(x_\mathrm{min}, x_\mathrm{max} \in \mathbb{R}\) and \(x_\mathrm{min} < x_\mathrm{max}\).
 * Support: \(x \in [x_\mathrm{min}, x_\mathrm{max}]\).
 *
 * @class ContinuousUniform
 * @memberOf ran.dist
 * @param {number=} xmin Lower boundary. Default value is 0.
 * @param {number=} xmax Upper boundary. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (xmin = 0, xmax = 1) {
    super('continuous', arguments.length)
    this.p = { xmin, xmax }
    this.s = [{
      value: xmin,
      closed: true
    }, {
      value: xmax,
      closed: true
    }]
    this.c = [xmax - xmin]
  }

  _generator () {
    // Direct sampling
    return Math.random() * this.c[0] + this.p.xmin
  }

  _pdf (x) {
    return 1 / this.c[0]
  }

  _cdf (x) {
    return x > this.p.xmax ? 1 : (x - this.p.xmin) / this.c[0]
  }
}
