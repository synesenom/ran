import Distribution from './_distribution'

/**
 * Probability density function for the [bounded Pareto distribution]{@link https://en.wikipedia.org/wiki/Pareto_distribution#Bounded_Pareto_distribution}:
 *
 * $f(x; L, H, \alpha) = \frac{\alpha L^\alpha x^{-\alpha - 1}}{1 - \big(\frac{L}{H}\big)^\alpha},$
 *
 * with $L, H > 0$, $H > L$ and $\alpha > 0$. Support: $x \in \[L, H\]$.
 *
 * Cumulative distribution function:
 *
 * $F(x; L, H, \alpha) = \frac{1 - (L/x)^{\alpha}}{1 - (L/H)^{\alpha}}$
 *
 * @class BoundedPareto
 * @memberof ran.dist
 * @constructor
 */
export default class BoundedPareto extends Distribution {
  /**
   * @param {number} L Lower boundary.
   * @param {number} H Upper boundary.
   * @param {number} alpha Shape parameter.
   */
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

  static _fitInit (data) {
    // L ≈ min(data) seeds scale; Hill estimator gives shape α; H ≈ max(data) bounds the support
    const L = Math.min(...data) * 0.99
    const H = Math.max(...data) * 1.01
    const n = data.length
    const alpha = n / Math.max(data.reduce((s, x) => s + Math.log(x / L), 0), 1e-9)
    return [L, H, alpha]
  }
}
