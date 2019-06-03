import Distribution from './_distribution'
import { noncentralChi2 } from './_core'
import { EPS, MAX_ITER } from '../special/_core'
import logGamma from '../special/log-gamma'
import { regularizedBetaIncomplete } from '../special/beta-incomplete'
import beta from '../special/beta'

function pdfTerm(n1, n2, l1, l2, t, t1, r, s) {
  return Math.exp(r * Math.log(l1 / 2) + s * Math.log(l2 / 2) + (n1 / 2 + r - 1) * Math.log(t) - ((n1 + n2) / 2 + r + s) * Math.log(t1) - logGamma(r + 1) - logGamma(s + 1)) / beta(n1 / 2 + r, n2 / 2 + s)
}

function cdfTerm(n1, n2, l1, l2, q, r, s) {
  return Math.exp(r * Math.log(l1 / 2) + s * Math.log(l2 / 2) - logGamma(r + 1) - logGamma(s + 1)) * regularizedBetaIncomplete(n1 / 2 + r, n2 / 2 + s, q)
}

/**
 * Generator for the [doubly non-central beta distribution]{@link https://rdrr.io/cran/sadists/f/inst/doc/sadists.pdf}:
 *
 * $$f(x; d_1, d_2, \lambda_1, \lambda_2) = e^{-\frac{\lambda_1 + \lambda_2}{2}} \sum_{k = 0}^\infty \sum_{l = 0}^\infty \frac{\big(\frac{\lambda_1}{2}\big)^k}{k!} \frac{\big(\frac{\lambda_2}{2}\big)^l}{l!} \frac{x^{\alpha + k - 1} (1 - x)^{\beta + l - 1}}{\mathrm{B}\big(\alpha + k, \beta + l\big)},$$
 *
 * where \(\alpha, \beta \in \mathbb{N}^+\) and \(\lambda_1, \lambda_2 \ge 0\). Support: \(x > 0\).
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
  // TODO Improve performance and simplify calculations
  constructor (alpha = 1, beta = 1, lambda1 = 1, lambda2 = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { alpha, beta, lambda1, lambda2 }
    Distribution._validate({ alpha, beta, lambda1, lambda2 }, [
      'alpha > 0',
      'beta > 0',
      'lambda1 >= 0',
      'lambda2 >= 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: 1,
      closed: true
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
    let n = this.p.alpha / this.p.beta
    let y = x / (n * (1 - x))
    let t = this.p.alpha * y / this.p.beta
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
        let ddz = pdfTerm(2 * this.p.alpha, 2 * this.p.beta, this.p.lambda1, this.p.lambda2, t, t1, r0 + kr, s0 + ks)

        dz += ddz
        if (Math.abs(ddz / dz) < EPS) {
          break
        }
      }

      // Backward s
      for (let s = s0 - 1; s >= 0; s--) {
        let ddz = pdfTerm(2 * this.p.alpha, 2 * this.p.beta, this.p.lambda1, this.p.lambda2, t, t1, r0 + kr, s)

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
        let ddz = pdfTerm(2 * this.p.alpha, 2 * this.p.beta, this.p.lambda1, this.p.lambda2, t, t1, r, s0 + ks)

        dz += ddz
        if (Math.abs(ddz / dz) < EPS) {
          break
        }
      }

      // Backward s
      for (let s = s0 - 1; s >= 0; s--) {
        let ddz = pdfTerm(2 * this.p.alpha, 2 * this.p.beta, this.p.lambda1, this.p.lambda2, t, t1, r, s)

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

    return this.p.alpha * Math.exp(-(this.p.lambda1 + this.p.lambda2) / 2) * z / (n * this.p.beta * Math.pow(1 - x, 2))
  }

  _cdf (x) {
    // Using outward summation
    let n = this.p.alpha / this.p.beta
    let y = x / (n * (1 - x))
    let t = this.p.alpha * y / this.p.beta
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
        let ddz = cdfTerm(2 * this.p.alpha, 2 * this.p.beta, this.p.lambda1, this.p.lambda2, q, r0 + kr, s0 + ks)

        dz += ddz
        if (Math.abs(ddz / dz) < EPS) {
          break
        }
      }

      // Backward s
      for (let s = s0 - 1; s >= 0; s--) {
        let ddz = cdfTerm(2 * this.p.alpha, 2 * this.p.beta, this.p.lambda1, this.p.lambda2, q, r0 + kr, s)

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
        let ddz = cdfTerm(2 * this.p.alpha, 2 * this.p.beta, this.p.lambda1, this.p.lambda2, q, r, s0 + ks)

        dz += ddz
        if (Math.abs(ddz / dz) < EPS) {
          break
        }
      }

      // Backward s
      for (let s = s0 - 1; s >= 0; s--) {
        let ddz = cdfTerm(2 * this.p.alpha, 2 * this.p.beta, this.p.lambda1, this.p.lambda2, q, r, s)

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