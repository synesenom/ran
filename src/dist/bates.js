import IrwinHall from './irwin-hall'
import Distribution from './_distribution'

/**
 * Probability density function for the [Bates distribution]{@link https://en.wikipedia.org/wiki/Bates_distribution}:
 *
 * $f(x; n, a, b) = \frac{n}{(b - a)(n - 1)!} \sum_{k = 0}^{\lfloor nz \rfloor} (-1)^k \begin{pmatrix}n \\\\ k \\\\ \end{pmatrix} (nz - k)^{n - 1},$
 *
 * with $z = \frac{x - a}{b - a}$, $n \in \mathbb{N}^+$ and $a, b \in \mathbb{R}, a < b$.
 * Support: $x \in \[a, b\]$.
 *
 * @class Bates
 * @memberof ran.dist
 * @constructor
 */
export default class Bates extends IrwinHall {
  // Transformation of Irwin-Hall
  /**
   * @param {number} n Number of uniform variates to sum. If not an integer, it is rounded to the nearest one.
   * @param {number} a Lower boundary of the uniform variate.
   * @param {number} b Upper boundary of the uniform variate.
   */
  constructor (n, a, b) {
    const ni = Math.round(n)
    super(ni)

    // Validate parameters
    this.p = Object.assign(this.p, { a, b })
    Distribution.validate({ a, b, n: ni }, [
      'n > 0',
      'a < b'
    ])

    // Set support
    this.s = [{
      value: a,
      closed: true
    }, {
      value: b,
      closed: true
    }]

    // Extend speed-up constants with Bates affine transform coefficients
    Object.assign(this.c, {
      scale: ni / (b - a),
      shift: ni * a / (b - a)
    })
  }

  _generator () {
    // Direct sampling by transforming Irwin-Hall variate
    return super._generator() / this.c.scale + this.p.a
  }

  _pdf (x) {
    const { scale, shift } = this.c
    return scale * super._pdf(scale * x - shift)
  }

  _cdf (x) {
    const { scale, shift } = this.c
    return super._cdf(scale * x - shift)
  }

  static _fitInit (data) {
    // Endpoints from sample extremes; n from variance moment: Var(Bates) = (b-a)²/(12n) → n = (b-a)²/(12σ̂²)
    const nData = data.length
    const lo = Math.min(...data)
    const hi = Math.max(...data)
    const eps = (hi - lo) * 0.01 || 1e-6
    const a = lo - eps
    const b = hi + eps
    const mean = data.reduce((s, x) => s + x, 0) / nData
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / nData || 1
    const n = Math.max(1, Math.round((b - a) ** 2 / (12 * variance)))
    return [n, a, b]
  }
}
