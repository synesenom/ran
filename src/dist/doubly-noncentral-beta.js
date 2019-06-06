import recursiveSum from '../algorithms/recursive-sum'
import Distribution from './_distribution'
import { noncentralChi2 } from './_core'
import { EPS, MAX_ITER } from '../special/_core'
import logGamma from '../special/log-gamma'
import { regularizedBetaIncomplete } from '../special/beta-incomplete'
import fnBeta from '../special/beta'

/**
 * Generator for the [doubly non-central beta distribution]{@link https://rdrr.io/cran/sadists/f/inst/doc/sadists.pdf}:
 *
 * $$f(x; \alpha, \beta, \lambda_1, \lambda_2) = e^{-\frac{\lambda_1 + \lambda_2}{2}} \sum_{k = 0}^\infty \sum_{l = 0}^\infty \frac{\big(\frac{\lambda_1}{2}\big)^k}{k!} \frac{\big(\frac{\lambda_2}{2}\big)^l}{l!} \frac{x^{\alpha + k - 1} (1 - x)^{\beta + l - 1}}{\mathrm{B}\big(\alpha + k, \beta + l\big)},$$
 *
 * where \(\alpha, \beta \in \mathbb{N}^+\) and \(\lambda_1, \lambda_2 \ge 0\). Support: \(x \in (0, 1)\).
 *
 * @class DoublyNoncentralBeta
 * @memberOf ran.dist
 * @param {number=} alpha First shape parameter. Default value is 1.
 * @param {number=} beta Second shape parameter. Default value is 1.
 * @param {number=} lambda1 First non-centrality parameter. Default value is 1.
 * @param {number=} lambda2 Second non-centrality parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (alpha = 1, beta = 1, lambda1 = 1, lambda2 = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = {alpha, beta, lambda1, lambda2}
    Distribution._validate({alpha, beta, lambda1, lambda2}, [
      'alpha > 0',
      'beta > 0',
      'lambda1 >= 0',
      'lambda2 >= 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: 1,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling from non-central chi2
    let x = noncentralChi2(this.r, 2 * this.p.alpha, this.p.lambda1)
    let y = noncentralChi2(this.r, 2 * this.p.beta, this.p.lambda2)
    let z = x / (x + y)

    // Handle 1 - z << 1 case
    if (z === 1) {
      return 1 - y / x
    } else {
      return z
    }
  }

  _pdf (x) {
    // Using outward summation
    let y = x / (1 - x)
    let ab = this.p.alpha + this.p.beta

    // Speed-up constants
    let l1 = this.p.lambda1 / 2
    let l2 = this.p.lambda2 / 2

    // Initial indices
    let r0 = Math.round(l1)
    let s0 = Math.round(l2)

    // Init terms
    let pr0 = Math.exp(r0 * Math.log(l1) - logGamma(r0 + 1))
    let ps0 = Math.exp(s0 * Math.log(l2) - logGamma(s0 + 1))
    let psf0 = (s0 > 0 ? s0 : 1) * ps0 / l2
    let yr0 = Math.pow(y, this.p.alpha + r0 - 2)
    let ys0 = Math.pow(1 + y, this.p.alpha + r0 + this.p.beta + s0 - 2)
    let b0 = fnBeta(this.p.alpha + r0, this.p.beta + s0)
    let bf0 = b0
    let bb0 = b0

    // Init delta and sum
    let dz = 0
    let z = 0

    // Forward r
    let ysf0 = ys0
    let pyrf = yr0 * pr0 * (r0 > 0 ? r0 : 1) / l1
    for (let kr = 0; kr < MAX_ITER; kr++) {
      let r = r0 + kr
      let rAlpha = this.p.alpha + r
      let dz = 0

      // Update terms
      ysf0 *= 1 + y
      pyrf *= y * l1 / (r > 0 ? r : 1)

      // Forward s
      dz += recursiveSum({
        y: ysf0 * (1 + y),
        p: psf0 * l2 / (s0 > 0 ? s0 : 1),
        b: bf0
      }, (t, i) => {
        let s = s0 + i
        t.y *= 1 + y
        t.p *= l2 / (s > 0 ? s : 1)
        return t
      }, t => pyrf * t.p / (t.b * t.y), (t, i) => {
        let s = s0 + i
        t.b *= (this.p.beta + s) / (ab + r + s)
        return t
      })

      // Backward s
      if (s0 > 0) {
        dz += recursiveSum({
          y: ysf0,
          p: s0 * ps0 / l2,
          b: bf0 * (ab + r + s0 - 1) / (this.p.beta + s0 - 1)
        }, (t, i) => {
          let s = s0 - i - 1
          if (s >= 0) {
            t.y /= 1 + y
            t.p *= (s + 1) / l2
            t.b *= (ab + r + s) / (this.p.beta + s)
          } else {
            t.p = 0
          }
          return t
        }, t => pyrf * t.p / (t.b * t.y))
      }

      // Add s-terms
      z += dz
      if (Math.abs(dz / z) < EPS) {
        break
      } else {
        bf0 *= rAlpha / (ab + r + s0)
      }
    }

    // Backward r
    if (r0 > 0) {
      let ysb0 = (1 + y) * ys0
      let pyrb = y * yr0 * pr0
      for (let r = r0 - 1; r >= 0; r--) {
        let dz = 0
        let rAlpha = this.p.alpha + r

        // Update terms
        ysb0 /= 1 + y
        pyrb *= (r + 1) / (y * l1)
        bb0 *= (ab + r + s0) / rAlpha

        // Forward s
        dz += recursiveSum({
          y: ysb0 * (1 + y),
          p: psf0 * l2 / (s0 > 0 ? s0 : 1),
          b: bb0
        }, (t, i) => {
          let s = s0 + i
          t.y *= 1 + y
          t.p *= l2 / (s > 0 ? s : 1)
          return t
        }, t => pyrb * t.p / (t.b * t.y), (t, i) => {
          let s = s0 + i
          t.b *= (this.p.beta + s) / (ab + r + s)
          return t
        })

        // Backward s
        if (s0 > 0) {
          dz += recursiveSum({
            y: ysb0,
            p: ps0 * s0 / l2,
            b: bb0 * (ab + r + s0 - 1) / (this.p.beta + s0 - 1)
          }, (t, i) => {
            let s = s0 - i - 1
            if (s >= 0) {
              t.y /= 1 + y
              t.p *= (s + 1) / l2
              t.b *= (ab + r + s) / (this.p.beta + s)
            } else {
              t.p = 0
            }
            return t
          }, t => pyrb * t.p / (t.b * t.y))
        }

        // Add s-terms
        z += dz
        if (Math.abs(dz / z) < EPS) {
          break
        }
      }
    }

    return Math.exp(-l1 - l2) * z / Math.pow(1 - x, 2)
  }

  _cdf (x) {
    // Using outward summation
    let r0 = Math.round(this.p.lambda1 / 2)
    let s0 = Math.round(this.p.lambda2 / 2)
    let sBeta0 = this.p.beta + s0 - 1

    // Speed-up constants
    let l1 = this.p.lambda1 / 2
    let l2 = this.p.lambda2 / 2

    // Init terms
    let pr0 = Math.exp(r0 * Math.log(l1) - logGamma(r0 + 1))
    let ps0 = Math.exp(s0 * Math.log(l2) - logGamma(s0 + 1))
    let psf0 = (s0 > 0 ? s0 : 1) * ps0 / l2
    let xa0 = Math.pow(x, this.p.alpha + r0)
    let xb0 = Math.pow(1 - x, this.p.beta + s0)
    let b0 = fnBeta(this.p.alpha + r0, this.p.beta + s0)
    let ib0 = regularizedBetaIncomplete(this.p.alpha + r0, this.p.beta + s0, x)

    // Delta and sum
    let dz = 0
    let z = 0

    // Forward r
    let prf = (r0 > 0 ? r0 : 1) * pr0 / l1
    let xaf = xa0
    let bf0 = b0
    let ibf0 = ib0
    for (let kr = 0; kr < MAX_ITER; kr++) {
      let r = r0 + kr
      let rAlpha = this.p.alpha + r
      let dz = 0

      // Update terms
      prf *= l1 / (r > 0 ? r : 1)

      // Forward s
      dz += recursiveSum({
        p: psf0 * l2 / (s0 > 0 ? s0 : 1),
        xb: xb0,
        b: bf0,
        ib: ibf0
      }, (t, i) => {
        let s = s0 + i
        t.p *= l2 / (s > 0 ? s : 1)
        return t
      }, t => prf * t.p * t.ib, (t, i) => {
        let s = s0 + i
        let sBeta = this.p.beta + s
        t.ib += xaf * t.xb / (sBeta * t.b)
        t.b *= sBeta / (rAlpha + sBeta)
        t.xb *= 1 - x
        return t
      })

      // Backward s
      if (s0 > 0) {
        let xb = xb0 / (1 - x)
        let bfb = bf0 * (rAlpha + sBeta0) / sBeta0
        dz += recursiveSum({
          p: ps0 * s0 / l2,
          xb,
          b: bfb,
          ib: ibf0 - xaf * xb / (sBeta0 * bfb)
        }, (t, i) => {
          let s = s0 - i - 1
          let sBeta = this.p.beta + s
          if (s >= 0) {
            t.p *= (s + 1) / l2
            t.xb /= 1 - x
            t.b *= (rAlpha + sBeta) / sBeta
            t.ib -= xaf * t.xb / (sBeta * t.b)
          } else {
            t.p = 0
            t.ib = 0
          }

          return t
        }, t => prf * t.p * t.ib)
      }

      // Add s-terms
      z += dz
      if (Math.abs(dz / z) < EPS) {
        break
      } else {
        ibf0 -= xaf * xb0 / (rAlpha * bf0)
        bf0 *= rAlpha / (rAlpha + this.p.beta + s0)
        xaf *= x
      }
    }

    // Backward r
    if (r0 > 0) {
      let prb = pr0
      let xab = xa0
      let bb0 = b0
      let ibb0 = ib0
      for (let r = r0 - 1; r >= 0; r--) {
        let dz = 0
        let rAlpha = this.p.alpha + r

        // Update terms
        prb *= (r + 1) / l1
        xab /= x
        bb0 *= (rAlpha + this.p.beta + s0) / rAlpha
        ibb0 += xab * xb0 / (rAlpha * bb0)

        // Forward s
        dz += recursiveSum({
          p: psf0 * l2 / (s0 > 0 ? s0 : 1),
          xb: xb0,
          b: bb0,
          ib: ibb0
        }, (t, i) => {
          let s = s0 + i
          t.p *= l2 / (s > 0 ? s : 1)
          return t
        }, t => prb * t.p * t.ib, (t, i) => {
          let s = s0 + i
          let sBeta = this.p.beta + s
          t.ib += xab * t.xb / (sBeta * t.b)
          t.b *= sBeta / (rAlpha + sBeta)
          t.xb *= 1 - x
          return t
        })

        // Backward s
        if (s0 > 0) {
          let xbb = xb0 / (1 - x)
          let bbb = bb0 * (rAlpha + sBeta0) / sBeta0
          dz += recursiveSum({
            p: ps0 * s0 / l2,
            xb: xb0 / (1 - x),
            b: bb0 * (rAlpha + sBeta0) / sBeta0,
            ib: ibb0 - xab * xbb / (sBeta0 * bbb)
          }, (t, i) => {
            let s = s0 - i - 1
            let sBeta = this.p.beta + s
            if (s >= 0) {
              t.p *= (s + 1) / l2
              t.xb /= 1 - x
              t.b *= (rAlpha + sBeta) / sBeta
              t.ib -= xab * t.xb / (sBeta * t.b)
            } else {
              t.p = 0
            }
            return t
          }, t => prb * t.p * t.ib)
        }

        // Add s-terms
        z += dz
        if (Math.abs(dz / z) < EPS) {
          break
        }
      }
    }

    return Math.max(0, Math.min(1, Math.exp(-l1 - l2) * z))
  }
}
