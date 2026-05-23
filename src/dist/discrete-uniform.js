import Distribution from './_distribution'

/**
 * Generator for the discrete
 * [uniform distribution]{@link https://en.wikipedia.org/wiki/Discrete_uniform_distribution}:
 *
 * $$f(k; x_\mathrm{min}, x_\mathrm{max}) = \frac{1}{x_\mathrm{max} - x_\mathrm{min} + 1},$$
 *
 * with $x_\mathrm{min}, x_\mathrm{max} \in \mathbb{Z}$ and $x_\mathrm{min} < x_\mathrm{max}$. Support: $k \in \{x_\mathrm{min}, ..., x_\mathrm{max}\}$.
 *
 * @class DiscreteUniform
 * @memberof ran.dist
 * @param {number} xmin Lower boundary. If not an integer, it is rounded to the nearest one.
 * @param {number} xmax Upper boundary. If not an integer, it is rounded to the nearest one.
 * @see https://en.wikipedia.org/wiki/Discrete_uniform_distribution
 * @constructor
 */
export default class extends Distribution {
  constructor (xmin, xmax) {
    super('discrete', 2)

    // Validate parameters
    const xmini = Math.round(xmin)
    const xmaxi = Math.round(xmax)
    this.p = { xmin: xmini, xmax: xmaxi }
    Distribution.validate({ xmin: xmini, xmax: xmaxi }, [
      'xmin <= xmax'
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
    this.c = {
      n: this.p.xmax - this.p.xmin + 1
    }
  }

  _generator () {
    // Direct sampling
    return this._q(this.r.next())
  }

  _pdf () {
    return 1 / this.c.n
  }

  _cdf (x) {
    return (1 + x - this.p.xmin) / this.c.n
  }

  _q (p) {
    // ceil(x)-1 equals floor(x) for non-integer x but gives x-1 when x is exactly an integer,
    // which is needed when p*N is exact so CDF(k) = p and the correct quantile is k, not k+1.
    return Math.ceil(p * this.c.n) - 1 + this.p.xmin
  }
}
