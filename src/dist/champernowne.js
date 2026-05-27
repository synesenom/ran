import Distribution from './_distribution'

/**
 * Probability density function for the [Champernowne distribution]{@link https://en.wikipedia.org/wiki/Champernowne_distribution}:
 *
 * $f(x; \alpha, \lambda, x_0) = \frac{C}{\cosh(\alpha(x - x_0)) + \lambda},$
 *
 * with normalization constant $C = \frac{\alpha\sqrt{1 - \lambda^2}}{2\arccos(\lambda)}$,
 * where $\alpha > 0$, $0 \le \lambda < 1$, and $x_0 \in \mathbb{R}$. Support: $x \in \mathbb{R}$.
 *
 * @class Champernowne
 * @memberof ran.dist
 * @constructor
 */
export default class Champernowne extends Distribution {
  /**
   * @param {number} alpha Shape parameter. Must be positive.
   * @param {number} lambda Asymmetry parameter. Must satisfy 0 <= lambda < 1.
   * @param {number} x0 Location parameter.
   */
  constructor (alpha, lambda, x0) {
    super('continuous', 3)

    // Validate parameters
    this.p = { alpha, lambda, x0 }
    Distribution.validate({ alpha, lambda, x0 }, [
      'alpha > 0',
      'lambda >= 0', 'lambda < 1'
    ])

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]

    // solutions/correctness/2026-05-23-1300-champernowne-stub-normalization-cdf-generator.md — norm derived via Weierstrass substitution
    const k = Math.sqrt((1 - lambda) / (1 + lambda))
    this.c = {
      k,
      atanK: Math.atan(k),
      norm: alpha * Math.sqrt(1 - lambda * lambda) / (2 * Math.acos(lambda))
    }
  }

  _generator () {
    // Inverse transform sampling via closed-form quantile
    return this._q(this.r.next())
  }

  _pdf (x) {
    return this.c.norm / (Math.cosh(this.p.alpha * (x - this.p.x0)) + this.p.lambda)
  }

  _cdf (x) {
    const t = Math.tanh(this.p.alpha * (x - this.p.x0) / 2)
    return (Math.atan(this.c.k * t) + this.c.atanK) / (2 * this.c.atanK)
  }

  _q (p) {
    return this.p.x0 + (2 / this.p.alpha) * Math.atanh(Math.tan((2 * p - 1) * this.c.atanK) / this.c.k)
  }
}
