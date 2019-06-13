import recursiveSum from '../algorithms/recursive-sum'
import betaFn from '../special/beta'
import logGamma from '../special/log-gamma'
import { regularizedBetaIncomplete } from '../special/beta-incomplete'
import { chi2, noncentralChi2 } from './_core'
import Distribution from './_distribution'

/**
 * Generator for the [non-central beta distribution]{@link https://en.wikipedia.org/wiki/Noncentral_beta_distribution}:
 *
 * $$f(x; d_1, d_2, \lambda) = e^{-\frac{\lambda}{2}} \sum_{k=0}^\infty \frac{1}{k!} \bigg(\frac{\lambda}{2}\bigg)^k \frac{x^{\alpha + k - 1} (1 - x)^{\beta - 1}}{\mathrm{B}\Big(\alpha + k, \beta\Big)},$$
 *
 * where \(\alpha, \beta > 0\) and \(\lambda \ge 0\). Support: \(x \in [0, 1]\).
 *
 * @class NoncentralBeta
 * @memberOf ran.dist
 * @param {number=} alpha First shape parameter. Default value is 1.
 * @param {number=} beta Second shape parameter. Default value is 1.
 * @param {number=} lambda Non-centrality parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  // TODO Use outward iteration
  constructor (alpha = 1, beta = 1, lambda = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { alpha, beta, lambda }
    Distribution._validate({ alpha, beta, lambda }, [
      'alpha > 0',
      'beta > 0',
      'lambda >= 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: 1,
      closed: true
    }]

    // Speed-up constants
    this.c = [
      Math.exp(-lambda / 2),
      betaFn(alpha, beta)
    ]
  }

  _generator () {
    // Direct sampling from non-central chi2 and chi2
    let x = noncentralChi2(this.r, 2 * this.p.alpha, this.p.lambda)
    let y = chi2(this.r, 2 * this.p.beta)
    let z = x / (x + y)

    // Handle 1 - z << 1 case
    if (z === 1) {
      return 1 - y / x
    } else {
      return z
    }
  }

  _pdf (x) {
    // Speed-up variables
    let l2 = this.p.lambda / 2
    let i0 = Math.round(l2)
    let iAlpha0 = this.p.alpha + i0

    // Init variables
    let p0 = Math.exp(-l2 + i0 * Math.log(l2) - logGamma(i0 + 1))
    let xa0 = Math.pow(x, iAlpha0 - 1)
    let xb = Math.pow(1 - x, this.p.beta - 1)
    let b0 = betaFn(iAlpha0, this.p.beta)

    // Forward sum
    let z = recursiveSum({
      p: p0,
      xa: xa0,
      b: b0
    }, (t, i) => {
      t.p *= l2 / (i + i0)
      return t
    }, t => t.p * t.xa * xb / t.b, (t, i) => {
      let iAlpha = iAlpha0 + i
      t.xa *= x
      t.b *= iAlpha / (iAlpha + this.p.beta)
      return t
    })

    if (i0 > 0) {
      iAlpha0--
      let xa = xa0 / x
      let b = b0 * (iAlpha0 + this.p.beta) / iAlpha0
      z += recursiveSum({
        p: p0 * i0 / l2,
        xa,
        b
      }, (t, i) => {
        let j = i0 - i - 1
        let iAlpha = iAlpha0 - i
        if (j >= 0) {
          t.p /= l2 / (j + 1)
          t.xa /= x
          t.b /= iAlpha / (iAlpha + this.p.beta)
        } else {
          t.p = 0
          t.ib = 0
        }
        return t
      }, t => t.p * t.xa * xb / t.b)
    }

    return z
  }

  _cdf (x) {
    // Speed-up variables
    let l2 = this.p.lambda / 2
    let i0 = Math.round(l2)
    let iAlpha0 = this.p.alpha + i0

    // Init variables
    let p0 = Math.exp(-l2 + i0 * Math.log(l2) - logGamma(i0 + 1))
    let xa0 = Math.pow(x, iAlpha0)
    let xb = Math.pow(1 - x, this.p.beta)
    let b0 = betaFn(iAlpha0, this.p.beta)
    let ib0 = regularizedBetaIncomplete(iAlpha0, this.p.beta, x)

    // Forward sum
    let z = recursiveSum({
      p: p0,
      xa: xa0,
      b: b0,
      ib: ib0
    }, (t, i) => {
      t.p *= l2 / (i + i0)
      return t
    }, t => t.p * t.ib, (t, i) => {
      let iAlpha = iAlpha0 + i
      t.ib -= t.xa * xb / (iAlpha * t.b)
      t.xa *= x
      t.b *= iAlpha / (iAlpha + this.p.beta)
      return t
    })

    // Backward sum
    if (i0 > 0) {
      iAlpha0--
      let xa = xa0 / x
      let b = b0 * (iAlpha0 + this.p.beta) / iAlpha0
      z += recursiveSum({
        p: p0 * i0 / l2,
        xa,
        b,
        ib: ib0 + xa * xb / (iAlpha0 * b)
      }, (t, i) => {
        let j = i0 - i - 1
        let iAlpha = iAlpha0 - i
        if (j >= 0) {
          t.p /= l2 / (j + 1)
          t.xa /= x
          t.b /= iAlpha / (iAlpha + this.p.beta)
          t.ib += t.xa * xb / (iAlpha * t.b)
        } else {
          t.p = 0
          t.ib = 0
        }
        return t
      }, t => t.p * t.ib)
    }

    return Math.min(1, z)
  }
}
