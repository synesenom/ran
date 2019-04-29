import RecursiveSum from '../algorithms/recursive-sum'
import logGamma from '../special/log-gamma'
import beta from '../special/beta'
import { regularizedBetaIncomplete } from '../special/beta-incomplete'
import { gamma, poisson } from './_core'
import Distribution from './_distribution'

/**
 * Generator for the [non-central F distribution]{@link https://en.wikipedia.org/wiki/Noncentral_F-distribution}:
 *
 * $$f(x; d_1, d_2, \lambda) = e^{-\frac{\lambda}{2}} \sum_{k=0}^\infty \frac{1}{k!} \bigg(\frac{\lambda}{2}\bigg)^k \frac{\Big(\frac{d_1}{d_2}\Big)^{\frac{d_1}{2} + k} \Big(\frac{d_2}{d_2 + d_1 x}\Big)^{\frac{d_1 + d_2}{2} + k}}{\mathrm{B}\Big(\frac{d_2}{2}, \frac{d_1}{2} + k\Big)} x^{\frac{d_1}{2} -1 + k},$$
 *
 * where \(d_1, d_2 \in \mathbb{N}^+\) and \(\lambda > 0\). Support: \(x \ge 0\).
 *
 * @class NonCentralF
 * @memberOf ran.dist
 * @param {number=} d1 First degree of freedom. If not an integer, it is rounded to the nearest one. Default value is 2.
 * @param {number=} d2 Second degree of freedom. If not an integer, it is rounded to the nearest one. Default value is 2.
 * @param {number=} lambda Non-centrality parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (d1 = 2, d2 = 2, lambda = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    let d1i = Math.round(d1)
    let d2i = Math.round(d2)
    this.p = { d1: d1i, d2: d2i, lambda }
    this._validate({ d1: d1i, d2: d2i, lambda }, [
      'd1 > 0',
      'd2 > 0',
      'lambda > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    this.c = [
      d1i / d2i,
      logGamma(d2i / 2),
      0.5 * (d1i + d2i)
    ]
  }

  _generator () {
    // Direct sampling from non-central chi2 and chi
    let x1 = gamma(this.r, this.p.d1 / 2 + poisson(this.r, this.p.lambda / 2), 0.5)
    let x2 = gamma(this.r, this.p.d2 / 2, 0.5)
    return x1 / (x2 * this.c[0])
  }

  _pdf (x) {
    // Init variables
    let a = this.c[2]
    let b = this.p.d1 / 2

    // Compute recursive sum
    return Math.exp(-0.5 * this.p.lambda) * RecursiveSum({
      // Gamma
      a: a,
      b: b,
      g: Math.exp(logGamma(a) - logGamma(b) - this.c[1]),

      // Multiplier
      c: Math.pow(this.c[0], b) * Math.pow(x, b - 1) / Math.pow(1 + this.c[0] * x, a)
    }, (t, r) => {
      t.c *= 0.5 * this.p.lambda * this.c[0] * (x / (1 + this.c[0] * x)) / r
      t.g *= t.a / t.b
      t.a++
      t.b++
      return t
    }, t => t.c * t.g)
  }

  _cdf (x) {
    // Init variables
    let y = this.c[0] * x
    let q = y / (1 + y)
    let a = this.p.d1 / 2
    let b = this.p.d2 / 2

    // Compute recursive sum
    return Math.exp(-0.5 * this.p.lambda) * RecursiveSum({
      // Scaled value
      q: q,

      // Multiplier
      c: 1,

      // Beta
      a: a,
      b: b,
      bxy: beta(a, b),

      // Incomplete beta
      xa: Math.pow(q, a),
      xb: Math.pow(1 - q, b),
      ix: regularizedBetaIncomplete(a, b, q)
    }, (t, i) => {
      t.c *= 0.5 * this.p.lambda / i
      t.ix = t.ix - t.xa * t.xb / (t.a * t.bxy)
      t.bxy *= t.a / (t.a + t.b)
      t.a++
      t.xa *= t.q
      return t
    }, t => t.c * t.ix)
  }
}
