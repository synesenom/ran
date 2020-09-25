import Distribution from './_distribution'

/**
 * Generator for the [Frechet distribution]{@link https://en.wikipedia.org/wiki/Frechet_distribution}:
 *
 * $$f(x; \alpha, s, m) = \frac{\alpha z^{-1 -\alpha} e^{-z^{-\alpha}}}{s},$$
 *
 * with $z = \frac{x - m}{s}$. and $\alpha, s > 0$, $m \in \mathbb{R}$. Support: $x \in \mathbb{R}, x > m$.
 *
 * @class Frechet
 * @memberof ran.dist
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @param {number=} s Scale parameter. Default value is 1.
 * @param {number=} m Location parameter. Default value is 0.
 * @constructor
 */
export default class extends Distribution {
  constructor (alpha = 1, s = 1, m = 0) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { alpha, s, m }
    Distribution.validate({ alpha, s, m }, [
      'alpha > 0',
      's > 0'
    ])

    // Set support
    this.s = [{
      value: m,
      closed: false
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
    const z = (x - this.p.m) / this.p.s
    return this.p.alpha * Math.exp(-Math.log(z) * (1 + this.p.alpha) - Math.pow(z, -this.p.alpha)) / this.p.s
  }

  _cdf (x) {
    return Math.exp(-Math.pow((x - this.p.m) / this.p.s, -this.p.alpha))
  }

  _q (p) {
    return this.p.m + this.p.s * Math.pow(-Math.log(p), -1 / this.p.alpha)
  }
}
