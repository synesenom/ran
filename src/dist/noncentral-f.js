import { EPS, MAX_ITER } from '../special/_core'
import RecursiveSum from '../algorithms/recursive-sum'
import logGamma from '../special/log-gamma'
import beta from '../special/beta'
import { regularizedBetaIncomplete } from '../special/beta-incomplete'
import { gamma, poisson } from './_core'
import Distribution from './_distribution'

export default class extends Distribution {
  constructor (d1 = 2, d2 = 2, lambda = 1) {
    super()

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
    // Build a recursive sum
    let a = this.c[2]
    let b = this.p.d1 / 2
    let S = new RecursiveSum({
      a: a,
      b: b,
      g: Math.exp(logGamma(a) - logGamma(b) - this.c[1]),
      c: Math.pow(this.c[0], b) * Math.pow(x, b - 1) / Math.pow(1 + this.c[0] * x, a)
    }, (t, r) => {
      t.c *= 0.5 * this.p.lambda * this.c[0] * (x / (1 + this.c[0] * x)) / r
      t.g *= t.a / t.b
      t.a++
      t.b++
      return t
    }, t => t.c * t.g)

    // Compute sum
    let z = S.compute()
    return typeof z === 'undefined' ? undefined : Math.exp(-0.5 * this.p.lambda) * z
  }

  _cdf (x) {
    // Build recursive sum
    let y = this.c[0] * x
    let q = y / (1 + y)
    let a = this.p.d1 / 2
    let b = this.p.d2 / 2
    let S = new RecursiveSum({
      q: q,
      c: 1,
      a: a,
      b: b,
      bxy: beta(a, b),
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

    // Compute sum
    let z = S.compute()
    return typeof z === 'undefined' ? undefined : Math.exp(-0.5 * this.p.lambda) * z
  }
}
