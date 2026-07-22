import clamp from '../utils/clamp'
import { recursiveSum } from '../algorithms'
import powell from '../algorithms/powell'
import { EPS, MAX_ITER } from '../core/constants'
import { regularizedBetaIncomplete, beta as fnBeta, logGamma } from '../special'
import noncentralChi2 from './_noncentral-chi2'
import NoncentralBeta from './noncentral-beta'
import Distribution from './_distribution'

/**
 * Probability density function for the [doubly non-central beta distribution]{@link https://arxiv.org/abs/1706.08557}:
 *
 * $f(x; \alpha, \beta, \lambda_1, \lambda_2) = e^{-\frac{\lambda_1 + \lambda_2}{2}} \sum\_{k = 0}^\infty \sum\_{l = 0}^\infty \frac{\big(\frac{\lambda_1}{2}\big)^k}{k!} \frac{\big(\frac{\lambda_2}{2}\big)^l}{l!} \frac{x^{\alpha + k - 1} (1 - x)^{\beta + l - 1}}{\mathrm{B}\big(\alpha + k, \beta + l\big)},$
 *
 * where $\alpha, \beta > 0$ and $\lambda_1, \lambda_2 \ge 0$. Support: $x \in (0, 1)$.
 *
 * @class DoublyNoncentralBeta
 * @memberof ran.dist
 * @constructor
 */
export default class DoublyNoncentralBeta extends Distribution {
  /**
   * @param {number} alpha First shape parameter.
   * @param {number} beta Second shape parameter.
   * @param {number} lambda1 First non-centrality parameter.
   * @param {number} lambda2 Second non-centrality parameter.
   */
  constructor (alpha, beta, lambda1, lambda2) {
    super('continuous', 4)

    // Validate parameters
    this.p = { alpha, beta, lambda1, lambda2 }
    Distribution.validate({ alpha, beta, lambda1, lambda2 }, [
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

    // Speed-up constants.
    // r0/s0/pr0/ps0/b0 are the double Poisson-mixing terms shared verbatim by _pdf and _cdf
    // (they depend only on alpha, beta, lambda1, lambda2, never on x).
    const l1 = lambda1 / 2
    const l2 = lambda2 / 2
    const r0 = Math.round(l1)
    const s0 = Math.round(l2)
    this.c = {
      l1,
      l2,
      r0,
      s0,
      // Guard l=0: 0*log(0) = NaN by IEEE 754, but the Poisson weight e^0 * 0^0 / 0! = 1.
      // (Never actually read: _pdf/_cdf both short-circuit away from this path when lambda=0.)
      pr0: l1 === 0 ? 1 : Math.exp(r0 * Math.log(l1) - logGamma(r0 + 1)),
      ps0: l2 === 0 ? 1 : Math.exp(s0 * Math.log(l2) - logGamma(s0 + 1)),
      b0: fnBeta(alpha + r0, beta + s0)
    }
  }

  // ─── PUBLIC STATIC ────────────────────────────────────────────────────────

  /**
   * Fits the distribution to a data set with a bounded Powell search budget. On data that
   * genuinely mismatches this family (also inherited by DoublyNoncentralF, which delegates its
   * _pdf/_cdf here), the nested double-Poisson-mixing log-likelihood carries a long, near-flat
   * ridge between the shape and non-centrality parameters: a full-precision Powell search (the
   * base class's default tol=1e-8, maxIter=200) chases negligible log-likelihood gains along this
   * ridge almost indefinitely, at ever-increasing per-point cost since larger non-centrality
   * parameters require more series terms to evaluate (#1063). Empirically, tol=1e-2/maxIter=15
   * recovers parameters within this class's existing fit tolerances on well-matched data (matching
   * the default optimizer's result within ordinary finite-sample noise) while bounding worst-case
   * cost to roughly 1-2s instead of 13-30s+ on mismatched data.
   *
   * @param {number[]} data Array of observations to fit.
   * @returns {DoublyNoncentralBeta} A new instance of the same distribution with MLE parameters.
   */
  static fit (data) {
    const Cls = this
    const x0 = Cls._fitInit(data)
    if (x0.length === 0) {
      return new Cls()
    }
    if (Distribution._isExactFit(Cls)) {
      return new Cls(...x0)
    }
    const objective = params => {
      try {
        const inst = new Cls(...params)
        const v = -inst.lnL(data) + Cls._fitPenalty(inst)
        return Number.isFinite(v) ? v : Infinity
      } catch (_) {
        return Infinity
      }
    }
    const best = powell(objective, Distribution._feasibleStart(objective, x0), { tol: 1e-2, maxIter: 15 })
    return new Cls(...best)
  }

  // ─── PROTECTED INSTANCE ───────────────────────────────────────────────────

  _generator () {
    // Direct sampling from non-central chi2
    const x = noncentralChi2(this.r, 2 * this.p.alpha, this.p.lambda1)
    const y = noncentralChi2(this.r, 2 * this.p.beta, this.p.lambda2)
    const z = x / (x + y)

    // Handle 1 - z << 1 case
    if (z === 1) {
      return 1 - y / x
    } else {
      return z
    }
  }

  _pdf (x) {
    // Poisson weight init r0 * log(l1) = 0 * -Inf = NaN when lambda1 or lambda2 is 0.
    // When lambda1=0 the double sum collapses to NoncentralBeta(beta, alpha, lambda2) at (1-x).
    if (this.p.lambda1 === 0) {
      return new NoncentralBeta(this.p.beta, this.p.alpha, this.p.lambda2)._pdf(1 - x)
    }
    // When lambda2=0 the double sum collapses to NoncentralBeta(alpha, beta, lambda1) at x.
    if (this.p.lambda2 === 0) {
      return new NoncentralBeta(this.p.alpha, this.p.beta, this.p.lambda1)._pdf(x)
    }

    const y = x / (1 - x)
    const { l1, l2, r0, s0, pr0, ps0, b0 } = this.c
    const ab = this.p.alpha + this.p.beta
    const yr0 = Math.pow(y, this.p.alpha + r0 - 2)
    const ys0 = Math.pow(1 + y, this.p.alpha + r0 + this.p.beta + s0 - 2)
    const ctx = { y, ab, l1, l2, r0, s0, pr0, ps0, yr0, ys0, b0 }

    const z = this._pdfRBackward(ctx, this._pdfRForward(ctx))
    return Math.exp(-l1 - l2) * z / Math.pow(1 - x, 2)
  }

  _cdf (x) {
    // Poisson weight init 0 * log(0) = NaN — same guard as _pdf.
    // F_DNB(x; a, b, 0, l2) = 1 - F_NB(1-x; b, a, l2) by symmetry of the Beta integral.
    if (this.p.lambda1 === 0) {
      return 1 - new NoncentralBeta(this.p.beta, this.p.alpha, this.p.lambda2)._cdf(1 - x)
    }
    if (this.p.lambda2 === 0) {
      return new NoncentralBeta(this.p.alpha, this.p.beta, this.p.lambda1)._cdf(x)
    }

    const { l1, l2, r0, s0, pr0, ps0, b0 } = this.c
    const betaParam = this.p.beta
    const sBeta0 = betaParam + s0 - 1
    const xa0 = Math.pow(x, this.p.alpha + r0)
    const xb0 = Math.pow(1 - x, betaParam + s0)
    const ib0 = regularizedBetaIncomplete(this.p.alpha + r0, betaParam + s0, x)
    const ctx = { l1, l2, r0, s0, pr0, ps0, sBeta0, xa0, xb0, b0, ib0, x }

    return clamp(Math.exp(-l1 - l2) * this._cdfRBackward(ctx, this._cdfRForward(ctx)))
  }

  // ─── PROTECTED STATIC ─────────────────────────────────────────────────────

  static _fitInit (data) {
    // Beta MOM for α, β; λ1=λ2 seeded at 0.5 since noncentrality is degenerate from moments
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1e-4
    const factor = Math.max(mean * (1 - mean) / variance - 1, 0.1)
    return [mean * factor, (1 - mean) * factor, 0.5, 0.5]
  }

  // ─── PRIVATE INSTANCE ─────────────────────────────────────────────────────

  _pdfRForward (ctx) {
    const { y, ab, l1, l2, r0, s0, ps0, yr0, pr0, ys0, b0 } = ctx

    let z = 0
    let bf0 = b0
    let ysf0 = ys0
    let pyrf = yr0 * pr0 * Math.max(r0, 1) / l1

    for (let kr = 0; kr < MAX_ITER; kr++) {
      const r = r0 + kr
      ysf0 *= 1 + y
      pyrf *= y * l1 / Math.max(r, 1)
      const dz = this._pdfSumOverS({ y, ab, l2, s0, ps0, r, pyr: pyrf, ys: ysf0, b: bf0 })
      z += dz
      if (Math.abs(dz / z) < EPS) {
        break
      } else {
        bf0 *= (this.p.alpha + r) / (ab + r + s0)
      }
    }

    return z
  }

  _pdfRBackward (ctx, z) {
    const { y, ab, l1, l2, r0, s0, ps0, yr0, pr0, ys0, b0 } = ctx

    let bb0 = b0
    let ysb0 = (1 + y) * ys0
    let pyrb = y * yr0 * pr0

    // Cap symmetrically with _pdfRForward's MAX_ITER bound: r0 (~lambda1/2) is unbounded, so
    // without this cap a large trial lambda1 during fit()'s Powell search makes this loop run
    // arbitrarily long (see decisions/0016-distribution-fit-powell-and-exact-mle.md).
    for (let r = r0 - 1; r >= Math.max(0, r0 - MAX_ITER); r--) {
      ysb0 /= 1 + y
      pyrb *= (r + 1) / (y * l1)
      bb0 *= (ab + r + s0) / (this.p.alpha + r)
      const dz = this._pdfSumOverS({ y, ab, l2, s0, ps0, r, pyr: pyrb, ys: ysb0, b: bb0 })
      z += dz
      if (Math.abs(dz / z) < EPS) {
        break
      }
    }

    return z
  }

  _pdfSumOverS ({ y, ab, l2, s0, ps0, r, pyr, ys, b }) {
    const betaParam = this.p.beta

    let dz = recursiveSum({
      y: ys * (1 + y),
      p: ps0,
      b
    }, (t, i) => {
      const s = s0 + i
      t.y *= 1 + y
      t.p *= l2 / Math.max(s, 1)
      return t
    }, t => pyr * t.p / (t.b * t.y), (t, i) => {
      const s = s0 + i
      t.b *= (betaParam + s) / (ab + r + s)
      return t
    })

    if (s0 > 0) {
      dz += recursiveSum({
        y: ys,
        p: s0 * ps0 / l2,
        b: b * (ab + r + s0 - 1) / (betaParam + s0 - 1)
      }, (t, i) => {
        const s = s0 - i - 1
        if (s >= 0) {
          t.y /= 1 + y
          t.p *= (s + 1) / l2
          t.b *= (ab + r + s) / (betaParam + s)
        } else {
          t.p = 0
        }
        return t
      }, t => pyr * t.p / (t.b * t.y))
    }

    return dz
  }

  _cdfRForward (ctx) {
    const { l1, l2, r0, s0, pr0, ps0, sBeta0, xa0, xb0, b0, ib0, x } = ctx
    const betaParam = this.p.beta

    let z = 0
    let prf = pr0 * Math.max(r0, 1) / l1
    let xaf = xa0
    let bf0 = b0
    let ibf0 = ib0

    for (let kr = 0; kr < MAX_ITER; kr++) {
      const r = r0 + kr
      const rAlpha = this.p.alpha + r
      prf *= l1 / Math.max(r, 1)
      const dz = this._cdfSumOverS({ l2, s0, ps0, xb0, sBeta0, x, r, pr: prf, xa: xaf, b: bf0, ib: ibf0 })
      z += dz
      if (Math.abs(dz / z) < EPS) {
        break
      } else {
        ibf0 -= xaf * xb0 / (rAlpha * bf0)
        bf0 *= rAlpha / (rAlpha + betaParam + s0)
        xaf *= x
      }
    }

    return z
  }

  _cdfRBackward (ctx, z) {
    const { l1, l2, r0, s0, pr0, ps0, sBeta0, xa0, xb0, b0, ib0, x } = ctx
    const betaParam = this.p.beta

    let prb = pr0
    let xab = xa0
    let bb0 = b0
    let ibb0 = ib0

    // Cap symmetrically with _cdfRForward's MAX_ITER bound; see _pdfRBackward for rationale.
    for (let r = r0 - 1; r >= Math.max(0, r0 - MAX_ITER); r--) {
      const rAlpha = this.p.alpha + r
      prb *= (r + 1) / l1
      xab /= x
      bb0 *= (rAlpha + betaParam + s0) / rAlpha
      ibb0 += xab * xb0 / (rAlpha * bb0)
      const dz = this._cdfSumOverS({ l2, s0, ps0, xb0, sBeta0, x, r, pr: prb, xa: xab, b: bb0, ib: ibb0 })
      z += dz
      if (Math.abs(dz / z) < EPS) {
        break
      }
    }

    return z
  }

  _cdfSumOverS ({ l2, s0, ps0, xb0, sBeta0, x, r, pr, xa, b, ib }) {
    const betaParam = this.p.beta
    const rAlpha = this.p.alpha + r

    let dz = recursiveSum({
      p: ps0,
      xb: xb0,
      b,
      ib
    }, (t, i) => {
      const s = s0 + i
      t.p *= l2 / Math.max(s, 1)
      return t
    }, t => pr * t.p * t.ib, (t, i) => {
      const s = s0 + i
      const sBeta = betaParam + s
      t.ib += xa * t.xb / (sBeta * t.b)
      t.b *= sBeta / (rAlpha + sBeta)
      t.xb *= 1 - x
      return t
    })

    if (s0 > 0) {
      const xbBack = xb0 / (1 - x)
      const bBack = b * (rAlpha + sBeta0) / sBeta0
      dz += recursiveSum({
        p: ps0 * s0 / l2,
        xb: xbBack,
        b: bBack,
        ib: ib - xa * xbBack / (sBeta0 * bBack)
      }, (t, i) => {
        const s = s0 - i - 1
        const sBeta = betaParam + s
        if (s >= 0) {
          t.p *= (s + 1) / l2
          t.xb /= 1 - x
          t.b *= (rAlpha + sBeta) / sBeta
          t.ib -= xa * t.xb / (sBeta * t.b)
        } else {
          t.p = 0
          t.ib = 0
        }
        return t
      }, t => pr * t.p * t.ib)
    }

    return dz
  }
}
