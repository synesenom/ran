import clamp from '../utils/clamp'
import { recursiveSum } from '../algorithms'
import powell from '../algorithms/powell'
import { EPS, MAX_ITER } from '../core/constants'
import { regularizedBetaIncomplete, logBeta, logGamma } from '../special'
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
    // r0/s0/pr0/ps0/outerScale/logB0 are the double Poisson-mixing terms shared verbatim by
    // _pdf and _cdf (they depend only on alpha, beta, lambda1, lambda2, never on x).
    const l1 = lambda1 / 2
    const l2 = lambda2 / 2
    const r0 = Math.round(l1)
    const s0 = Math.round(l2)
    // Guard l=0: 0*log(0) = NaN by IEEE 754, but the Poisson weight e^0 * 0^0 / 0! = 1.
    // (Never actually read: _pdf/_cdf both short-circuit away from this path when lambda=0.)
    const rawR = l1 === 0 ? 0 : r0 * Math.log(l1) - logGamma(r0 + 1)
    const rawS = l2 === 0 ? 0 : s0 * Math.log(l2) - logGamma(s0 + 1)
    // Deferring exp(-l1-l2) to a single outer-scale multiplication in _pdf/_cdf (matching this
    // class's pre-#1075 formulation) is the more precise option: multiplying an exact 1.0
    // through the whole recurrence chain rounds nowhere, whereas folding -l1/-l2 into pr0/ps0
    // multiplies every single step of that chain by a non-trivial constant instead — measurably
    // worse (e.g. DoublyNoncentralBeta(2,2,2,2).pdf(0.95) loses precision from ~1e-15 to ~1e-14
    // once folded unconditionally). Deferring is unsafe in two ways, both guarded here with
    // margin below the hard IEEE 754 limits: rawR/rawS themselves overflow Number.MAX_VALUE
    // past ~709 (lambda1/lambda2 past ~1418, issue #1075's own reported threshold), AND —
    // independently, e.g. lambda1=lambda2=1200 trips this while leaving rawR/rawS individually
    // safe — outerScale = exp(-l1-l2) underflows to exact 0 past l1+l2 ~745, which would then
    // multiply an unnormalized (and, left deferred, correspondingly huge) z by 0 and produce
    // NaN the moment z itself is Infinity rather than the intended finite cancellation.
    const deferScale = rawR < 700 && rawS < 700 && l1 + l2 < 700
    this.c = {
      l1,
      l2,
      r0,
      s0,
      pr0: l1 === 0 ? 1 : Math.exp(deferScale ? rawR : rawR - l1),
      ps0: l2 === 0 ? 1 : Math.exp(deferScale ? rawS : rawS - l2),
      outerScale: deferScale ? Math.exp(-l1 - l2) : 1,
      // Beta(alpha+r0, beta+s0) underflows to exact 0 once r0 and s0 are both large (e.g.
      // Beta(1002,1002) ~ 1e-604, far below Number.MIN_VALUE) — tracked as a log from the
      // start so it never has to be materialized as an unrepresentable linear double (#1075).
      logB0: logBeta(alpha + r0, beta + s0)
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
   * See solutions/performance/2026-07-22-0702-doubly-noncentral-fit-powell-ridge-cost.md
   *
   * @method fit
   * @memberof ran.dist.DoublyNoncentralBeta
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
    // y^(alpha+r0-2) and (1+y)^(alpha+r0+beta+s0-2) are tracked as logs alongside logB0: for x
    // near/above 0.5 with large r0+s0, the linear power itself overflows to Infinity (e.g.
    // (1+y)^2000 at y=1) well before it ever combines with the underflowed Beta constant (#1075).
    const logY = Math.log(y)
    const log1py = Math.log(1 + y)
    const { l1, l2, r0, s0, pr0, ps0, outerScale, logB0 } = this.c
    const ab = this.p.alpha + this.p.beta
    const logYr0 = (this.p.alpha + r0 - 2) * logY
    const logYs0 = (ab + r0 + s0 - 2) * log1py
    const ctx = { logY, log1py, ab, l1, l2, r0, s0, pr0, ps0, logYr0, logYs0, logB0 }

    const z = this._pdfRBackward(ctx, this._pdfRForward(ctx))
    return outerScale * z / Math.pow(1 - x, 2)
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

    const { l1, l2, r0, s0, pr0, ps0, outerScale, logB0 } = this.c
    const betaParam = this.p.beta
    const sBeta0 = betaParam + s0 - 1
    // x^(alpha+r0) and (1-x)^(beta+s0) underflow toward 0 as r0/s0 grow (x, 1-x < 1), colliding
    // with the underflowed Beta constant the same way the pdf's power terms do (#1075) — tracked
    // as logs so the ib-recurrence's correction term is combined before ever exponentiating.
    const logX = Math.log(x)
    const log1mx = Math.log(1 - x)
    const logXa0 = (this.p.alpha + r0) * logX
    const logXb0 = (betaParam + s0) * log1mx
    const ib0 = regularizedBetaIncomplete(this.p.alpha + r0, betaParam + s0, x)
    const ctx = { l1, l2, r0, s0, pr0, ps0, sBeta0, logX, log1mx, logXa0, logXb0, logB0, ib0 }

    return clamp(outerScale * this._cdfRBackward(ctx, this._cdfRForward(ctx)))
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
    const { logY, log1py, ab, l1, l2, r0, s0, ps0, pr0, logYr0, logYs0, logB0 } = ctx

    let z = 0
    let logBf0 = logB0
    let logYsf0 = logYs0
    let prf = pr0 * Math.max(r0, 1) / l1
    let logYrf = logYr0

    for (let kr = 0; kr < MAX_ITER; kr++) {
      const r = r0 + kr
      logYsf0 += log1py
      logYrf += logY
      prf *= l1 / Math.max(r, 1)
      const dz = this._pdfSumOverS({ log1py, ab, l2, s0, ps0, r, pr: prf, logYr: logYrf, logYs: logYsf0, logB: logBf0 })
      z += dz
      if (Math.abs(dz / z) < EPS) {
        break
      } else {
        logBf0 += Math.log((this.p.alpha + r) / (ab + r + s0))
      }
    }

    return z
  }

  _pdfRBackward (ctx, z) {
    const { logY, log1py, ab, l1, l2, r0, s0, ps0, pr0, logYr0, logYs0, logB0 } = ctx

    let logBb0 = logB0
    let logYsb0 = logYs0 + log1py
    let prb = pr0
    let logYrb = logYr0 + logY

    // Cap symmetrically with _pdfRForward's MAX_ITER bound: r0 (~lambda1/2) is unbounded, so
    // without this cap a large trial lambda1 during fit()'s Powell search makes this loop run
    // arbitrarily long (see decisions/0016-distribution-fit-powell-and-exact-mle.md).
    for (let r = r0 - 1; r >= Math.max(0, r0 - MAX_ITER); r--) {
      logYsb0 -= log1py
      prb *= (r + 1) / l1
      logYrb -= logY
      logBb0 += Math.log((ab + r + s0) / (this.p.alpha + r))
      const dz = this._pdfSumOverS({ log1py, ab, l2, s0, ps0, r, pr: prb, logYr: logYrb, logYs: logYsb0, logB: logBb0 })
      z += dz
      if (Math.abs(dz / z) < EPS) {
        break
      }
    }

    return z
  }

  _pdfSumOverS ({ log1py, ab, l2, s0, ps0, r, pr, logYr, logYs, logB }) {
    const betaParam = this.p.beta

    let dz = recursiveSum({
      logYs: logYs + log1py,
      p: ps0,
      logB
    }, (t, i) => {
      const s = s0 + i
      t.logYs += log1py
      t.p *= l2 / Math.max(s, 1)
      return t
    }, t => pr * t.p * Math.exp(logYr - t.logB - t.logYs), (t, i) => {
      const s = s0 + i
      t.logB += Math.log((betaParam + s) / (ab + r + s))
      return t
    })

    if (s0 > 0) {
      dz += recursiveSum({
        logYs,
        p: s0 * ps0 / l2,
        logB: logB + Math.log((ab + r + s0 - 1) / (betaParam + s0 - 1))
      }, (t, i) => {
        const s = s0 - i - 1
        if (s >= 0) {
          t.logYs -= log1py
          t.p *= (s + 1) / l2
          t.logB += Math.log((ab + r + s) / (betaParam + s))
        } else {
          t.p = 0
        }
        return t
      }, t => pr * t.p * Math.exp(logYr - t.logB - t.logYs))
    }

    return dz
  }

  _cdfRForward (ctx) {
    const { l1, l2, r0, s0, pr0, ps0, sBeta0, logX, log1mx, logXa0, logXb0, logB0, ib0 } = ctx
    const betaParam = this.p.beta

    let z = 0
    let prf = pr0 * Math.max(r0, 1) / l1
    let logXaf = logXa0
    let logBf0 = logB0
    let ibf0 = ib0

    for (let kr = 0; kr < MAX_ITER; kr++) {
      const r = r0 + kr
      const rAlpha = this.p.alpha + r
      prf *= l1 / Math.max(r, 1)
      const dz = this._cdfSumOverS({ l2, s0, ps0, logXb0, sBeta0, log1mx, r, pr: prf, logXa: logXaf, logB: logBf0, ib: ibf0 })
      z += dz
      if (Math.abs(dz / z) < EPS) {
        break
      } else {
        ibf0 -= Math.exp(logXaf + logXb0 - logBf0) / rAlpha
        logBf0 += Math.log(rAlpha / (rAlpha + betaParam + s0))
        logXaf += logX
      }
    }

    return z
  }

  _cdfRBackward (ctx, z) {
    const { l1, l2, r0, s0, pr0, ps0, sBeta0, logX, log1mx, logXa0, logXb0, logB0, ib0 } = ctx
    const betaParam = this.p.beta

    let prb = pr0
    let logXab = logXa0
    let logBb0 = logB0
    let ibb0 = ib0

    // Cap symmetrically with _cdfRForward's MAX_ITER bound; see _pdfRBackward for rationale.
    for (let r = r0 - 1; r >= Math.max(0, r0 - MAX_ITER); r--) {
      const rAlpha = this.p.alpha + r
      prb *= (r + 1) / l1
      logXab -= logX
      logBb0 += Math.log((rAlpha + betaParam + s0) / rAlpha)
      ibb0 += Math.exp(logXab + logXb0 - logBb0) / rAlpha
      const dz = this._cdfSumOverS({ l2, s0, ps0, logXb0, sBeta0, log1mx, r, pr: prb, logXa: logXab, logB: logBb0, ib: ibb0 })
      z += dz
      if (Math.abs(dz / z) < EPS) {
        break
      }
    }

    return z
  }

  _cdfSumOverS ({ l2, s0, ps0, logXb0, sBeta0, log1mx, r, pr, logXa, logB, ib }) {
    const betaParam = this.p.beta
    const rAlpha = this.p.alpha + r

    let dz = recursiveSum({
      p: ps0,
      logXb: logXb0,
      logB,
      ib
    }, (t, i) => {
      const s = s0 + i
      t.p *= l2 / Math.max(s, 1)
      return t
    }, t => pr * t.p * t.ib, (t, i) => {
      const s = s0 + i
      const sBeta = betaParam + s
      t.ib += Math.exp(logXa + t.logXb - t.logB) / sBeta
      t.logB += Math.log(sBeta / (rAlpha + sBeta))
      t.logXb += log1mx
      return t
    })

    if (s0 > 0) {
      const logXbBack = logXb0 - log1mx
      const logBBack = logB + Math.log((rAlpha + sBeta0) / sBeta0)
      dz += recursiveSum({
        p: ps0 * s0 / l2,
        logXb: logXbBack,
        logB: logBBack,
        ib: ib - Math.exp(logXa + logXbBack - logBBack) / sBeta0
      }, (t, i) => {
        const s = s0 - i - 1
        const sBeta = betaParam + s
        if (s >= 0) {
          t.p *= (s + 1) / l2
          t.logXb -= log1mx
          t.logB += Math.log((rAlpha + sBeta) / sBeta)
          t.ib -= Math.exp(logXa + t.logXb - t.logB) / sBeta
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
