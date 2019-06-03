import beta from '../special/beta'
import logGamma from '../special/log-gamma'
import { noncentralChi2 } from './_core'
import Distribution from './_distribution'
import { EPS, MAX_ITER } from '../special/_core'
import { regularizedBetaIncomplete } from '../special/beta-incomplete'

function pdfTerm(n1, n2, l1, l2, t, t1, r, s) {
  return Math.exp(r * Math.log(l1 / 2) + s * Math.log(l2 / 2) + (n1 / 2 + r - 1) * Math.log(t) - ((n1 + n2) / 2 + r + s) * Math.log(t1) - logGamma(r + 1) - logGamma(s + 1)) / beta(n1 / 2 + r, n2 / 2 + s)
}

function cdfTerm(n1, n2, l1, l2, q, r, s) {
  return Math.exp(r * Math.log(l1 / 2) + s * Math.log(l2 / 2) - logGamma(r + 1) - logGamma(s + 1)) * regularizedBetaIncomplete(n1 / 2 + r, n2 / 2 + s, q)
}

/**
 * Generator for the [doubly non-central F distribution]{@link https://rdrr.io/cran/sadists/f/inst/doc/sadists.pdf}:
 *
 * $$f(x; d_1, d_2, \lambda_1, \lambda_2) = \frac{d_1}{d_2} e^{-\frac{\lambda_1 + \lambda_2}{2}} \sum_{k = 0}^\infty \sum_{l = 0}^\infty \frac{\big(\frac{\lambda_1}{2}\big)^k}{k!} \frac{\big(\frac{\lambda_2}{2}\big)^l}{l!} \frac{\big(\frac{d_1 x}{d_2}\big)^{\frac{d_1}{2} + k - 1}}{\big(1 + \frac{d_1 x}{d_2}\big)^{\frac{d_1 + d_2}{2} + k + l}} \frac{1}{\mathrm{B}\big(\frac{d_1}{2} + k, \frac{d_2}{2} + l\big)},$$
 *
 * where \(d_1, d_2 \in \mathbb{N}^+\) and \(\lambda_1, \lambda_2 \ge 0\). Support: \(x > 0\).
 *
 * @class DoublyNoncentralF
 * @memberOf ran.dist
 * @param {number=} d1 First degrees of freedom. If not an integer, it is rounded to the nearest one. Default value is 2.
 * @param {number=} d2 Second degrees of freedom. If not an integer, it is rounded to the nearest one. Default value is 2.
 * @param {number=} lambda1 First non-centrality parameter. Default value is 1.
 * @param {number=} lambda2 Second non-centrality parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  // TODO Improve performance
  // TODO Transform beta
  constructor (d1 = 2, d2 = 2, lambda1 = 1, lambda2 = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    let d1i = Math.round(d1)
    let d2i = Math.round(d2)
    this.p = { d1: d1i, d2: d2i, lambda1, lambda2 }
    Distribution._validate({ d1: d1i, d2: d2i, lambda1, lambda2 }, [
      'd1 > 0',
      'd2 > 0',
      'lambda1 >= 0',
      'lambda2 >= 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    let x1 = noncentralChi2(this.r, this.p.d1, this.p.lambda1)
    let x2 = noncentralChi2(this.r, this.p.d2, this.p.lambda2)
    return (x1 / this.p.d1) / (x2 / this.p.d2)
  }

  _pdf (x) {
    // Using outward summation
    let t = this.p.d1 * x / this.p.d2
    let t1 = 1 + t
    let r0 = Math.round(this.p.lambda1 / 2)
    let s0 = Math.round(this.p.lambda2 / 2)
    let dz = 0
    let z = 0

    // Forward r
    for (let kr = 0; kr < MAX_ITER; kr++) {
      let dz = 0

      // Forward s
      for (let ks = 0; ks < MAX_ITER; ks++) {
        let ddz = pdfTerm(this.p.d1, this.p.d2, this.p.lambda1, this.p.lambda2, t, t1, r0 + kr, s0 + ks)

        dz += ddz
        if (Math.abs(ddz / dz) < EPS) {
          break
        }
      }

      // Backward s
      for (let s = s0 - 1; s >= 0; s--) {
        let ddz = pdfTerm(this.p.d1, this.p.d2, this.p.lambda1, this.p.lambda2, t, t1, r0 + kr, s)

        dz += ddz
        if (Math.abs(ddz / dz) < EPS) {
          break
        }
      }

      // Add s-terms
      z += dz
      if (Math.abs(dz / z) < EPS) {
        break
      }
    }

    // Backward r
    for (let r = r0 - 1; r >= 0; r--) {
      let dz = 0

      // Forward s
      for (let ks = 0; ks < MAX_ITER; ks++) {
        let ddz = pdfTerm(this.p.d1, this.p.d2, this.p.lambda1, this.p.lambda2, t, t1, r, s0 + ks)

        dz += ddz
        if (Math.abs(ddz / dz) < EPS) {
          break
        }
      }

      // Backward s
      for (let s = s0 - 1; s >= 0; s--) {
        let ddz = pdfTerm(this.p.d1, this.p.d2, this.p.lambda1, this.p.lambda2, t, t1, r, s)

        dz += ddz
        if (Math.abs(ddz / dz) < EPS) {
          break
        }
      }

      // Add s-terms
      z += dz
      if (Math.abs(dz / z) < EPS) {
        break
      }
    }

    return this.p.d1 * Math.exp(-(this.p.lambda1 + this.p.lambda2) / 2) * z / this.p.d2
  }

  _cdf (x) {
    // Using outward summation
    let t = this.p.d1 * x / this.p.d2
    let q = t / (1 + t)
    let r0 = Math.round(this.p.lambda1 / 2)
    let s0 = Math.round(this.p.lambda2 / 2)
    let dz = 0
    let z = 0

    // Forward r
    for (let kr = 0; kr < MAX_ITER; kr++) {
      let dz = 0

      // Forward s
      for (let ks = 0; ks < MAX_ITER; ks++) {
        let ddz = cdfTerm(this.p.d1, this.p.d2, this.p.lambda1, this.p.lambda2, q, r0 + kr, s0 + ks)

        dz += ddz
        if (Math.abs(ddz / dz) < EPS) {
          break
        }
      }

      // Backward s
      for (let s = s0 - 1; s >= 0; s--) {
        let ddz = cdfTerm(this.p.d1, this.p.d2, this.p.lambda1, this.p.lambda2, q, r0 + kr, s)

        dz += ddz
        if (Math.abs(ddz / dz) < EPS) {
          break
        }
      }

      // Add s-terms
      z += dz
      if (Math.abs(dz / z) < EPS) {
        break
      }
    }

    // Backward r
    for (let r = r0 - 1; r >= 0; r--) {
      let dz = 0

      // Forward s
      for (let ks = 0; ks < MAX_ITER; ks++) {
        let ddz = cdfTerm(this.p.d1, this.p.d2, this.p.lambda1, this.p.lambda2, q, r, s0 + ks)

        dz += ddz
        if (Math.abs(ddz / dz) < EPS) {
          break
        }
      }

      // Backward s
      for (let s = s0 - 1; s >= 0; s--) {
        let ddz = cdfTerm(this.p.d1, this.p.d2, this.p.lambda1, this.p.lambda2, q, r, s)

        dz += ddz
        if (Math.abs(ddz / dz) < EPS) {
          break
        }
      }

      // Add s-terms
      z += dz
      if (Math.abs(dz / z) < EPS) {
        break
      }
    }

    return Math.exp(-(this.p.lambda1 + this.p.lambda2) / 2) * z
  }
}
