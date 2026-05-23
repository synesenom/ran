import recursiveSum from '../algorithms/recursive-sum'
import { regularizedBetaIncomplete, beta as fnBeta, logGamma } from '../special'
import chi2 from './_chi2'
import noncentralChi2 from './_noncentral-chi2'
import Distribution from './_distribution'

/**
 * Generator for the [non-central beta distribution]{@link https://en.wikipedia.org/wiki/Noncentral_beta_distribution}:
 *
 * $$f(x; \alpha, \beta, \lambda) = e^{-\frac{\lambda}{2}} \sum\_{k = 0}^\infty \frac{1}{k!} \bigg(\frac{\lambda}{2}\bigg)^k \frac{x^{\alpha + k - 1} (1 - x)^{\beta - 1}}{\mathrm{B}(\alpha + k, \beta)},$$
 *
 * where $\alpha, \beta > 0$ and $\lambda \ge 0$. Support: $x \in \[0, 1\]$.
 *
 * @class NoncentralBeta
 * @memberof ran.dist
 * @param {number=} alpha First shape parameter. Default value is 1.
 * @param {number=} beta Second shape parameter. Default value is 1.
 * @param {number=} lambda Non-centrality parameter. Default value is 1.
 * @see https://en.wikipedia.org/wiki/Noncentral_beta_distribution
 * @constructor
 */
export default class extends Distribution {
  constructor (alpha, beta, lambda) {
    super('continuous', 3)

    // Validate parameters.
    this.p = { alpha, beta, lambda }
    Distribution.validate({ alpha, beta, lambda }, [
      'alpha > 0',
      'beta > 0',
      'lambda >= 0'
    ])

    // Set support.
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: 1,
      closed: true
    }]

    // Speed-up constants.
    this.c = {
      expHalfLambda: Math.exp(-lambda / 2),
      beta: fnBeta(alpha, beta)
    }
  }

  _generator () {
    // Direct sampling from non-central chi2 and chi2.
    const x = noncentralChi2(this.r, 2 * this.p.alpha, this.p.lambda)
    const y = chi2(this.r, 2 * this.p.beta)
    const z = x / (x + y)

    // Handle 1 - z << 1 case.
    if (Math.abs(1 - z) < Number.EPSILON) {
      return 1 - y / x
    } else {
      return z
    }
  }

  _pdf (x) {
    // At x=0: x^(alpha+k-1) collapses to 0 for all k when alpha>1; only k=0 survives when alpha=1;
    // diverges for alpha<1 since x^(alpha-1) → +∞.
    if (x === 0) {
      if (this.p.alpha > 1) return 0
      if (this.p.alpha < 1) return Infinity
      // alpha===1: k=0 term is e^(-lambda/2)*(1-0)^(beta-1)/B(1,beta); all k>=1 vanish since 0^k=0.
      return this.c.expHalfLambda / this.c.beta
    }

    // Speed-up variables.
    const l2 = this.p.lambda / 2
    const i0 = Math.round(l2)
    let iAlpha0 = this.p.alpha + i0

    // Init variables.
    // Guard l2=0: 0*log(0) = NaN by IEEE 754, but the Poisson weight e^0 * 0^0 / 0! = 1.
    const p0 = l2 === 0 ? 1 : Math.exp(-l2 + i0 * Math.log(l2) - logGamma(i0 + 1))
    const xa0 = Math.pow(x, iAlpha0 - 1)
    const xb = Math.pow(1 - x, this.p.beta - 1)
    const b0 = fnBeta(iAlpha0, this.p.beta)

    // Forward sum.
    let z = recursiveSum({
      p: p0,
      xa: xa0,
      b: b0
    }, (t, i) => {
      t.p *= l2 / (i + i0)
      return t
    }, t => t.p * t.xa * xb / t.b, (t, i) => {
      const iAlpha = iAlpha0 + i
      t.xa *= x
      t.b *= iAlpha / (iAlpha + this.p.beta)
      return t
    })

    // Backward sum.
    if (i0 > 0) {
      iAlpha0--
      const xa = xa0 / x
      const b = b0 * (iAlpha0 + this.p.beta) / iAlpha0
      z += recursiveSum({
        p: p0 * i0 / l2,
        xa,
        b
      }, (t, i) => {
        const j = i0 - i - 1
        const iAlpha = iAlpha0 - i
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
    // regularizedBetaIncomplete + series produce NaN at exact x = 0; CDF is 0 at the closed lower support
    if (x === 0) return 0

    // Speed-up variables
    const l2 = this.p.lambda / 2
    const i0 = Math.round(l2)
    let iAlpha0 = this.p.alpha + i0

    // Init variables
    // Guard l2=0: 0*log(0) = NaN by IEEE 754, but the Poisson weight e^0 * 0^0 / 0! = 1.
    const p0 = l2 === 0 ? 1 : Math.exp(-l2 + i0 * Math.log(l2) - logGamma(i0 + 1))
    const xa0 = Math.pow(x, iAlpha0)
    const xb = Math.pow(1 - x, this.p.beta)
    const b0 = fnBeta(iAlpha0, this.p.beta)
    const ib0 = regularizedBetaIncomplete(iAlpha0, this.p.beta, x)

    // Forward sum.
    let z = recursiveSum({
      p: p0,
      xa: xa0,
      b: b0,
      ib: ib0
    }, (t, i) => {
      t.p *= l2 / (i + i0)
      return t
    }, t => t.p * t.ib, (t, i) => {
      const iAlpha = iAlpha0 + i
      t.ib -= t.xa * xb / (iAlpha * t.b)
      t.xa *= x
      t.b *= iAlpha / (iAlpha + this.p.beta)
      return t
    })

    // Backward sum.
    if (i0 > 0) {
      iAlpha0--
      const xa = xa0 / x
      const b = b0 * (iAlpha0 + this.p.beta) / iAlpha0
      z += recursiveSum({
        p: p0 * i0 / l2,
        xa,
        b,
        ib: ib0 + xa * xb / (iAlpha0 * b)
      }, (t, i) => {
        const j = i0 - i - 1
        const iAlpha = iAlpha0 - i
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

    // Series can produce a small negative value via floating-point cancellation; symmetric guard with Math.min(1, ...).
    return Math.max(0, Math.min(1, z))
  }
}
