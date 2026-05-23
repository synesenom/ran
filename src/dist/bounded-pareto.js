import Distribution from './_distribution'

/**
 * Generator for the [bounded Pareto distribution]{@link https://en.wikipedia.org/wiki/Pareto_distribution#Bounded_Pareto_distribution}:
 *
 * $$f(x; L, H, \alpha) = \frac{\alpha L^\alpha x^{-\alpha - 1}}{1 - \big(\frac{L}{H}\big)^\alpha},$$
 *
 * with $L, H > 0$, $H > L$ and $\alpha > 0$. Support: $x \in \[L, H\]$.
 *
 * @class BoundedPareto
 * @memberof ran.dist
 * @param {number} L Lower boundary.
 * @param {number} H Upper boundary.
 * @param {number} alpha Shape parameter.
 * @see https://en.wikipedia.org/wiki/Pareto_distribution#Bounded_Pareto_distribution
 * @constructor
 */
export default class extends Distribution {
  constructor (L, H, alpha) {
    super('continuous', 3)

    // Validate parameters
    this.p = { L, H, alpha }
    Distribution.validate({ L, H, alpha }, [
      'L > 0',
      'H > 0',
      'L < H',
      'alpha > 0'
    ])

    // Set support
    this.s = [{
      value: L,
      closed: true
    }, {
      value: H,
      closed: true
    }]

    // Speed-up constants
    this.c = {
      Lalpha: Math.pow(L, alpha),
      Halpha: Math.pow(H, alpha),
      denom: 1 - Math.pow(L / H, alpha)
    }
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return this.p.alpha * Math.pow(this.p.L / x, this.p.alpha) / (x * this.c.denom)
  }

  _cdf (x) {
    return (1 - this.c.Lalpha * Math.pow(x, -this.p.alpha)) / this.c.denom
  }

  _q (p) {
    return Math.pow((this.c.Halpha + p * (this.c.Lalpha - this.c.Halpha)) / (this.c.Lalpha * this.c.Halpha), -1 / this.p.alpha)
  }
}
