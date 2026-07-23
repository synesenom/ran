import clamp from '../utils/clamp'
import { EPS, MAX_SERIES_ITER } from '../core/constants'
import { regularizedBetaIncomplete, logBeta, logGamma } from '../special'
import noncentralChi2 from './_noncentral-chi2'
import NoncentralBeta from './noncentral-beta'
import Distribution from './_distribution'

// Threshold for _pdf/_cdf's relocated-walk fallback trigger (#1102) — deliberately far looser
// than EPS: an ordinary, already-converged sum's last term can sit a few ULP above EPS*total
// purely from accumulated rounding over hundreds of additions, which would otherwise falsely
// trigger relocation on cases that are already correct to ~12 significant figures. Genuine
// non-convergence (the standard walk's window missing the true peak) leaves dz/z at 0.1-1, many
// orders of magnitude above this, so the gap between the two leaves ample margin either way.
const RELOCATE_TOL = 1e-9

// Per-direction iteration cap for _pdfRelocated/_cdfRelocated's outer and inner walks — smaller
// than MAX_SERIES_ITER (500) because each term there costs a fresh logGamma/logBeta evaluation
// (no O(1) recurrence, unlike the standard walk), so the worst case scales with the SQUARE of
// this cap (outer * inner). At MAX_SERIES_ITER this made a single relocated pdf()/cdf() call cost
// hundreds of milliseconds — catastrophic multiplied across fit()'s tens of thousands of trial
// evaluations (#1063's ridge-cost guard). RELOCATE_MAX_ITER is picked to comfortably clear the
// empirically-observed convergence depth of the cases #1102 targets while keeping worst-case cost
// bounded; see solutions/ for the specific timing measurements this was tuned against.
const RELOCATE_MAX_ITER = 150

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
    /** @type {*} */
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
    this.c = {
      l1,
      l2,
      r0,
      s0,
      ...DoublyNoncentralBeta._poissonWeights(l1, l2, r0, s0),
      // Beta(alpha+r0, beta+s0) underflows to exact 0 once r0 and s0 are both large (e.g.
      // Beta(1002,1002) ~ 1e-604, far below Number.MIN_VALUE) — tracked as a log from the
      // start so it never has to be materialized as an unrepresentable linear double (#1075).
      logB0: logBeta(alpha + r0, beta + s0)
    }
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

    const forward = this._pdfRForward(ctx)
    const backward = this._pdfRBackward(ctx, forward.z)
    // Convergence is judged against the FINAL combined total, not each direction's own (smaller)
    // partial sum: a direction that broke early against its own partial sum is automatically also
    // negligible against the larger final total, so this loses no early-break cases, but it
    // additionally catches a direction that exhausted its budget with an already-small dz that
    // only *looked* significant relative to its own small partial sum. RELOCATE_TOL (not EPS) is
    // the trigger: comparing the last term against EPS*total flags cases already accurate to ~12
    // significant figures purely from ordinary last-ULP rounding (e.g. lambda1=lambda2=8000,
    // x=0.6/0.7, where forward alone needs a handful more than 500 steps to fully bottom out even
    // though the combined total is already correct to ~1e-12) — RELOCATE_TOL is comfortably above
    // that rounding floor (by ~7 orders of magnitude) while still far below the genuine failures
    // this exists to catch, which leave dz/z at 0.1-1, not merely a few ULPs (#1102).
    const standard = outerScale * backward.z / Math.pow(1 - x, 2)
    if (Math.abs(forward.lastDz) >= RELOCATE_TOL * Math.abs(backward.z) || Math.abs(backward.lastDz) >= RELOCATE_TOL * Math.abs(backward.z)) {
      const rStar = DoublyNoncentralBeta._peakIndex(l1, x, this.p.alpha, this.p.beta + s0)
      const sStar = DoublyNoncentralBeta._peakIndex(l2, 1 - x, this.p.beta, this.p.alpha + rStar)
      // _peakIndex locates where the summand's density peaks, which is the right relocation
      // target when the standard window's own neighborhood contributes negligibly (x far enough
      // from 0.5 that the true peak has shifted out of reach) -- but not every non-convergent case
      // is like that: sometimes the standard window already sits on the right mass and merely
      // needs a handful more than MAX_SERIES_ITER steps to fully bottom out (e.g. lambda1=
      // lambda2=20000, x=0.7), in which case relocating moves to a region with negligible weight
      // of its own and returns something far too small. Since every term either walk sums is
      // non-negative, both results are valid partial lower bounds on the true value -- taking the
      // larger is a safe, cheap guard against the (already-verified-possible) relocation failure
      // mode without having to first classify which regime a given (x, lambda) falls into (#1102).
      return Math.max(standard, this._pdfRelocated(x, rStar, sStar))
    }
    return standard
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

    const forward = this._cdfRForward(ctx)
    const backward = this._cdfRBackward(ctx, forward.z)
    // Convergence check against the final combined total — see _pdf's identical check for why
    // RELOCATE_TOL, not EPS. Reuses _pdf's _peakIndex as the relocation center (not a formula
    // based on where Ireg(alpha+r, beta+s, x) itself crosses 0.5): that alternative was tried and
    // rejected — Ireg's crossing point ignores where the Poisson weight is actually concentrated,
    // so it can sit tens of Poisson-sigmas from any non-negligible mass (verified: lambda1=
    // lambda2=8000, x=0.3 relocated to a point ~36 sigma from r0, in a region where Poisson(r; l1)
    // itself is negligible, producing a near-zero result regardless of Ireg's value there) — the
    // walk needs to be centered where the combined Poisson*Ireg product has its mass, which
    // _peakIndex already locates correctly for the same reason it works for the pdf (#1102).
    const standard = outerScale * backward.z
    if (Math.abs(forward.lastDz) >= RELOCATE_TOL * Math.abs(backward.z) || Math.abs(backward.lastDz) >= RELOCATE_TOL * Math.abs(backward.z)) {
      const rStar = DoublyNoncentralBeta._peakIndex(l1, x, this.p.alpha, betaParam + s0)
      const sStar = DoublyNoncentralBeta._peakIndex(l2, 1 - x, betaParam, this.p.alpha + rStar)
      // Same non-negative-terms safety net as _pdf's identical guard: relocating to the density
      // peak is wrong when the standard window's own neighborhood already holds the real mass and
      // just needs a few more steps (verified: lambda1=lambda2=20000, x=0.7 relocates to a
      // ~25-sigma-away point with negligible weight, returning ~3e-156 against a true value near
      // 1) — take whichever partial lower bound is larger (#1102).
      return clamp(Math.max(standard, this._cdfRelocated(x, rStar, sStar)))
    }
    return clamp(standard)
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

  /**
   * Bounds fit()'s Powell search budget. On data that genuinely mismatches this family (also
   * inherited by DoublyNoncentralF, which delegates its _pdf/_cdf here), the nested
   * double-Poisson-mixing log-likelihood carries a long, near-flat ridge between the shape and
   * non-centrality parameters: a full-precision Powell search (the base class's default
   * tol=1e-8, maxIter=200) chases negligible log-likelihood gains along this ridge almost
   * indefinitely, at ever-increasing per-point cost since larger non-centrality parameters
   * require more series terms to evaluate (#1063). Empirically, tol=1e-2/maxIter=15 recovers
   * parameters within this class's existing fit tolerances on well-matched data (matching the
   * default optimizer's result within ordinary finite-sample noise) while bounding worst-case
   * cost to roughly 1-2s instead of 13-30s+ on mismatched data.
   * See solutions/performance/2026-07-22-0702-doubly-noncentral-fit-powell-ridge-cost.md
   *
   * maxIter also bounds each inner Brent line search powell() runs per outer sweep, not just the
   * outer sweep count itself (#1078). Investigated across 35 well-matched fits (7 parameter sets
   * x 5 seeds): a decoupled, much larger inner-Brent budget produced bit-identical results,
   * confirming maxIter=15 is not starving convergence there. On the same family-mismatched ridge
   * data this fix targets, a larger inner budget did recover a meaningfully better log-likelihood
   * (~16-32%) — but at the cost of reintroducing multi-second-plus fit() runs on that same data,
   * i.e. exactly the cost blowup this fix exists to bound. The coupled maxIter=15 is kept as-is:
   * on mismatched data, looser convergence is the deliberate, already-documented tradeoff above,
   * not an unrelated defect to fix separately. See
   * solutions/performance/2026-07-22-1600-doubly-noncentral-fit-inner-line-search-budget.md
   *
   * @method _powellOptions
   * @memberof ran.dist.DoublyNoncentralBeta
   * @returns {Object} The bounded Powell search options.
   */
  static _powellOptions () {
    return { tol: 1e-2, maxIter: 15 }
  }

  // ─── PRIVATE INSTANCE ─────────────────────────────────────────────────────

  _pdfRForward (ctx) {
    const { logY, log1py, ab, l1, l2, r0, s0, ps0, pr0, logYr0, logYs0, logB0 } = ctx

    let z = 0
    let logBf0 = logB0
    let logYsf0 = logYs0
    let prf = pr0 * Math.max(r0, 1) / l1
    let logYrf = logYr0

    let lastDz = 0
    for (let kr = 0; kr < MAX_SERIES_ITER; kr++) {
      const r = r0 + kr
      logYsf0 += log1py
      logYrf += logY
      prf *= l1 / Math.max(r, 1)
      const dz = this._pdfSumOverS({ log1py, ab, l2, s0, ps0, r, pr: prf, logYr: logYrf, logYs: logYsf0, logB: logBf0 })
      z += dz
      lastDz = dz
      if (Math.abs(dz / z) < EPS) {
        break
      } else {
        logBf0 += Math.log((this.p.alpha + r) / (ab + r + s0))
      }
    }

    return { z, lastDz }
  }

  _pdfRBackward (ctx, z) {
    const { logY, log1py, ab, l1, l2, r0, s0, ps0, pr0, logYr0, logYs0, logB0 } = ctx

    let logBb0 = logB0
    let logYsb0 = logYs0 + log1py
    let prb = pr0
    let logYrb = logYr0 + logY

    // Cap symmetrically with _pdfRForward's bound: r0 (~lambda1/2) is unbounded, so without this
    // cap a large trial lambda1 during fit()'s Powell search makes this loop run arbitrarily long
    // (see decisions/0016-distribution-fit-powell-and-exact-mle.md). The cap is MAX_SERIES_ITER,
    // not the smaller MAX_ITER: the (r,s) term's peak shifts away from (r0,s0) as x moves away
    // from 0.5 (e.g. lambda1=lambda2=1200, x=0.3 shifts the peak ~146 steps below r0), so a
    // window of only MAX_ITER=100 steps can end before ever reaching the true peak, silently
    // truncating the sum by many orders of magnitude (#1086). MAX_SERIES_ITER is the same cap
    // _seriesSum uses for exactly this class of series, per its own doc comment above and
    // MAX_SERIES_ITER's own doc comment in src/core/constants.js.
    // r0 === 0 means there is no backward direction left to walk (r can't go negative) — nothing
    // omitted, so lastDz starts at 0 (trivially negligible relative to any nonzero final total).
    let lastDz = 0
    for (let r = r0 - 1; r >= Math.max(0, r0 - MAX_SERIES_ITER); r--) {
      logYsb0 -= log1py
      prb *= (r + 1) / l1
      logYrb -= logY
      logBb0 += Math.log((ab + r + s0) / (this.p.alpha + r))
      const dz = this._pdfSumOverS({ log1py, ab, l2, s0, ps0, r, pr: prb, logYr: logYrb, logYs: logYsb0, logB: logBb0 })
      z += dz
      lastDz = dz
      if (Math.abs(dz / z) < EPS) {
        break
      }
    }

    return { z, lastDz }
  }

  _pdfSumOverS ({ log1py, ab, l2, s0, ps0, r, pr, logYr, logYs, logB }) {
    const betaParam = this.p.beta

    let dz = this._seriesSum({
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
      dz += this._seriesSum({
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

    let lastDz = 0
    for (let kr = 0; kr < MAX_SERIES_ITER; kr++) {
      const r = r0 + kr
      const rAlpha = this.p.alpha + r
      prf *= l1 / Math.max(r, 1)
      const dz = this._cdfSumOverS({ l2, s0, ps0, logXb0, sBeta0, log1mx, r, pr: prf, logXa: logXaf, logB: logBf0, ib: ibf0 })
      z += dz
      lastDz = dz
      if (Math.abs(dz / z) < EPS) {
        break
      } else {
        ibf0 -= Math.exp(logXaf + logXb0 - logBf0) / rAlpha
        logBf0 += Math.log(rAlpha / (rAlpha + betaParam + s0))
        logXaf += logX
      }
    }

    return { z, lastDz }
  }

  _cdfRBackward (ctx, z) {
    const { l1, l2, r0, s0, pr0, ps0, sBeta0, logX, log1mx, logXa0, logXb0, logB0, ib0 } = ctx
    const betaParam = this.p.beta

    let prb = pr0
    let logXab = logXa0
    let logBb0 = logB0
    let ibb0 = ib0

    // Cap symmetrically with _cdfRForward's bound; see _pdfRBackward for the MAX_SERIES_ITER
    // rationale (#1086). r0 === 0: see _pdfRBackward's identical guard.
    let lastDz = 0
    for (let r = r0 - 1; r >= Math.max(0, r0 - MAX_SERIES_ITER); r--) {
      const rAlpha = this.p.alpha + r
      prb *= (r + 1) / l1
      logXab -= logX
      logBb0 += Math.log((rAlpha + betaParam + s0) / rAlpha)
      ibb0 += Math.exp(logXab + logXb0 - logBb0) / rAlpha
      const dz = this._cdfSumOverS({ l2, s0, ps0, logXb0, sBeta0, log1mx, r, pr: prb, logXa: logXab, logB: logBb0, ib: ibb0 })
      z += dz
      lastDz = dz
      if (Math.abs(dz / z) < EPS) {
        break
      }
    }

    return { z, lastDz }
  }

  _cdfSumOverS ({ l2, s0, ps0, logXb0, sBeta0, log1mx, r, pr, logXa, logB, ib }) {
    const betaParam = this.p.beta
    const rAlpha = this.p.alpha + r

    let dz = this._seriesSum({
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
      dz += this._seriesSum({
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

  /**
   * Same accumulation algorithm as recursiveSum (src/algorithms/recursive-sum.js), but without
   * its Math.max(Math.abs(sum), 1) absolute-EPS floor: that floor treats any running sum below 1
   * as if it were exactly 1 for convergence purposes, so it falsely declares convergence after
   * only 1-2 terms whenever the true converged value is itself far below 1 in magnitude —
   * routine for this distribution's pdf/cdf at large lambda1/lambda2 away from x=0.5 (e.g.
   * ~1e-21), silently truncating the s-sum by tens of orders of magnitude (#1086). A purely
   * relative check is safe here specifically because every term _pdfSumOverS/_cdfSumOverS
   * accumulates is a non-negative probability-weighted density or incomplete-beta value (no
   * cancellation), so the running sum never legitimately converges to exactly 0 while
   * significant terms remain — recursiveSum's floor exists to guard series that can, which this
   * one structurally cannot. Local to this file rather than changing recursiveSum itself, since
   * that helper is shared by many unrelated series summations (Kummer's ₁F₁, other noncentral
   * CDFs) whose typical magnitudes make the floor appropriate for them.
   * See solutions/correctness/2026-07-23-1108-doubly-noncentral-beta-recursivesum-absolute-floor-truncation.md
   *
   * @method _seriesSum
   * @memberof ran.dist.DoublyNoncentralBeta
   * @param {Object} x0 Initial term-computation state.
   * @param {Function} preUpdate State updater invoked before computing each term after the first.
   * @param {Function} termFn Computes the term value from the current state.
   * @param {Function=} postUpdate State updater invoked after a term, only if not yet converged.
   * @returns {number} The accumulated sum.
   * @private
   */
  _seriesSum (x0, preUpdate, termFn, postUpdate) {
    let x = x0
    let delta
    let sum = termFn(x)
    if (postUpdate) {
      x = postUpdate(x, 0)
    }
    for (let i = 1; i < MAX_SERIES_ITER; i++) {
      x = preUpdate(x, i)
      delta = termFn(x)
      sum += delta
      if (Math.abs(delta) < EPS * Math.abs(sum)) {
        break
      } else if (postUpdate) {
        x = postUpdate(x, i)
      }
    }
    return sum
  }

  /**
   * pdf(x) walk from a relocated center (rStar, sStar) instead of (r0, s0) — used once _pdf's
   * threshold check finds the true peak too far from r0 for the standard walk to reach (#1102).
   * Each (r, s) term is computed directly via _logPdfTerm rather than through the standard walk's
   * incremental pr0/logB0 recurrences: those recurrences start from a Poisson weight normalized
   * at r0/s0, which underflows to exact 0 in linear form long before combining with the
   * compensating Beta-density factor once evaluated thousands of steps away at rStar/sStar — the
   * exact failure this method exists to avoid. Capped at RELOCATE_MAX_ITER, not MAX_SERIES_ITER:
   * a per-term-fresh logGamma/logBeta evaluation (rather than an O(1) recurrence step) is too
   * costly to repeat MAX_SERIES_ITER^2 times worst case — an incremental-recurrence version was
   * attempted and discarded after repeated sign errors in deriving it under time pressure (the
   * b-varying incomplete-beta recurrence in particular has an easy-to-invert sign convention);
   * the smaller, empirically-verified-sufficient cap here keeps this rare, already-broken-without-
   * it fallback path both correct and bounded, including during fit()'s Powell search where a
   * pathological trial lambda can otherwise call this path tens of thousands of times (#1063).
   *
   * @method _pdfRelocated
   * @memberof ran.dist.DoublyNoncentralBeta
   * @param {number} x Value to evaluate the pdf at.
   * @param {number} rStar Relocated center for the outer (lambda1) index.
   * @param {number} sStar Relocated center for the inner (lambda2) index at rStar.
   * @returns {number} The pdf value.
   * @private
   */
  _pdfRelocated (x, rStar, sStar) {
    const log1mx = Math.log(1 - x)
    let z = 0
    for (let kr = 0; kr < RELOCATE_MAX_ITER; kr++) {
      const dz = this._pdfTermSumOverS(rStar + kr, sStar, x, log1mx)
      z += dz
      if (Math.abs(dz / z) < EPS) {
        break
      }
    }
    for (let r = rStar - 1; r >= Math.max(0, rStar - RELOCATE_MAX_ITER); r--) {
      const dz = this._pdfTermSumOverS(r, sStar, x, log1mx)
      z += dz
      if (Math.abs(dz / z) < EPS) {
        break
      }
    }
    return z
  }

  /**
   * Inner s-sum (forward + backward from sCenter) for _pdfRelocated's outer r-walk, one fixed r
   * at a time. sCenter is shared across the whole outer walk rather than re-estimated per r: the
   * (1-x)-driven pull on the s-peak is far weaker than x's pull on the r-peak (log(1-x) is much
   * closer to 0 than log(x) whenever x is far below 0.5, and symmetrically for x far above 0.5),
   * so a single relocated center comfortably covers the whole RELOCATE_MAX_ITER-wide r-window.
   *
   * Tracks logB/logPs via the same O(1)-per-step recurrences _pdfSumOverS uses (one logBeta and
   * one logGamma-based Poisson weight computed ONCE per r, not once per (r, s) pair) rather than
   * calling _logPdfTerm fresh for every s: at RELOCATE_MAX_ITER's outer*inner worst case, a fresh
   * logGamma/logBeta per term made a single relocated call cost hundreds of milliseconds —
   * catastrophic multiplied across fit()'s trial evaluations (#1063's ridge-cost guard, #1102).
   *
   * @method _pdfTermSumOverS
   * @memberof ran.dist.DoublyNoncentralBeta
   * @param {number} r Current outer index.
   * @param {number} sCenter Relocated center for the inner sum.
   * @param {number} x Value to evaluate the pdf at.
   * @param {number} log1mx log(1 - x), precomputed once per outer walk.
   * @returns {number} The summed contribution over s for this r.
   * @private
   */
  _pdfTermSumOverS (r, sCenter, x, log1mx) {
    const { alpha, beta } = this.p
    const { l1, l2 } = this.c
    const ab = alpha + beta
    const logPr = DoublyNoncentralBeta._logPoissonWeight(r, l1)
    const logYr = (alpha + r - 1) * Math.log(x)
    const logB0 = logBeta(alpha + r, beta + sCenter)

    let z = 0
    let logB = logB0
    let logPs = DoublyNoncentralBeta._logPoissonWeight(sCenter, l2)
    for (let ks = 0; ks < RELOCATE_MAX_ITER; ks++) {
      const s = sCenter + ks
      const dz = Math.exp(logPr + logPs + logYr + (beta + s - 1) * log1mx - logB)
      z += dz
      if (Math.abs(dz / z) < EPS) {
        break
      }
      logB += Math.log(beta + s) - Math.log(ab + r + s)
      logPs += Math.log(l2) - Math.log(s + 1)
    }

    logB = logB0
    logPs = DoublyNoncentralBeta._logPoissonWeight(sCenter, l2)
    for (let s = sCenter - 1; s >= Math.max(0, sCenter - RELOCATE_MAX_ITER); s--) {
      logB += Math.log(ab + r + s) - Math.log(beta + s)
      logPs += Math.log(s + 1) - Math.log(l2)
      const dz = Math.exp(logPr + logPs + logYr + (beta + s - 1) * log1mx - logB)
      z += dz
      if (Math.abs(dz / z) < EPS) {
        break
      }
    }

    return z
  }

  /**
   * cdf(x) walk from a relocated center, mirroring _pdfRelocated — see its comment for why a
   * relocated, log-domain walk is needed instead of the standard recurrence-based one, and why it
   * is capped at RELOCATE_MAX_ITER rather than MAX_SERIES_ITER (#1102).
   *
   * @method _cdfRelocated
   * @memberof ran.dist.DoublyNoncentralBeta
   * @param {number} x Value to evaluate the cdf at.
   * @param {number} rStar Relocated center for the outer (lambda1) index.
   * @param {number} sStar Relocated center for the inner (lambda2) index at rStar.
   * @returns {number} The cdf value (before the caller's clamp to [0, 1]).
   * @private
   */
  _cdfRelocated (x, rStar, sStar) {
    let z = 0
    for (let kr = 0; kr < RELOCATE_MAX_ITER; kr++) {
      const dz = this._cdfTermSumOverS(rStar + kr, sStar, x)
      z += dz
      if (Math.abs(dz / z) < EPS) {
        break
      }
    }
    for (let r = rStar - 1; r >= Math.max(0, rStar - RELOCATE_MAX_ITER); r--) {
      const dz = this._cdfTermSumOverS(r, sStar, x)
      z += dz
      if (Math.abs(dz / z) < EPS) {
        break
      }
    }
    return z
  }

  /**
   * Inner s-sum for _cdfRelocated's outer r-walk, one fixed r at a time — see _pdfTermSumOverS
   * for why sCenter is shared across the whole outer walk instead of re-estimated per r. Calls
   * regularizedBetaIncomplete fresh per term rather than an incremental recurrence (unlike the
   * pdf side): an incremental version was attempted and produced a result measurably different
   * from the verified-correct reference, and time did not allow tracking down the discrepancy
   * before shipping — RELOCATE_MAX_ITER is kept small specifically to bound this slower path's
   * cost; see the class-level note citing the follow-up issue for revisiting this.
   *
   * @method _cdfTermSumOverS
   * @memberof ran.dist.DoublyNoncentralBeta
   * @param {number} r Current outer index.
   * @param {number} sCenter Relocated center for the inner sum.
   * @param {number} x Value to evaluate the cdf at.
   * @returns {number} The summed contribution over s for this r.
   * @private
   */
  _cdfTermSumOverS (r, sCenter, x) {
    const { alpha, beta } = this.p
    const { l1, l2 } = this.c
    const logPr = DoublyNoncentralBeta._logPoissonWeight(r, l1)
    let z = 0
    for (let ks = 0; ks < RELOCATE_MAX_ITER; ks++) {
      const s = sCenter + ks
      const dz = Math.exp(logPr + DoublyNoncentralBeta._logPoissonWeight(s, l2)) * regularizedBetaIncomplete(alpha + r, beta + s, x)
      z += dz
      if (Math.abs(dz / z) < EPS) {
        break
      }
    }
    for (let s = sCenter - 1; s >= Math.max(0, sCenter - RELOCATE_MAX_ITER); s--) {
      const dz = Math.exp(logPr + DoublyNoncentralBeta._logPoissonWeight(s, l2)) * regularizedBetaIncomplete(alpha + r, beta + s, x)
      z += dz
      if (Math.abs(dz / z) < EPS) {
        break
      }
    }
    return z
  }

  // ─── PRIVATE STATIC ───────────────────────────────────────────────────────

  /**
   * Poisson-weight speed-up constants pr0/ps0, deferring exp(-l1-l2) to a single outerScale
   * multiplication in _pdf/_cdf (this class's pre-#1075, most precise formulation) whenever
   * it's safe: multiplying an exact 1.0 through the whole recurrence chain rounds nowhere,
   * whereas folding -l1/-l2 into pr0/ps0 multiplies every step of that chain by a non-trivial
   * constant instead — measurably worse (e.g. DoublyNoncentralBeta(2,2,2,2).pdf(0.95) loses
   * precision from ~1e-15 to ~1e-14 once folded unconditionally). Deferring is unsafe in two
   * ways, both guarded here with margin below the hard IEEE 754 limits: the unnormalized
   * Poisson-weight exponent (rawR/rawS) overflows Number.MAX_VALUE past ~709 (lambda1/lambda2
   * past ~1418, issue #1075's own reported threshold), and — independently, e.g.
   * lambda1=lambda2=1200 trips this while leaving rawR/rawS individually safe — outerScale =
   * exp(-l1-l2) underflows to exact 0 past l1+l2 ~745, which would then multiply an
   * unnormalized (and, left deferred, correspondingly huge) sum by 0 and produce NaN the
   * moment that sum is Infinity rather than the intended finite cancellation.
   *
   * @method _poissonWeights
   * @memberof ran.dist.DoublyNoncentralBeta
   * @param {number} l1 lambda1 / 2.
   * @param {number} l2 lambda2 / 2.
   * @param {number} r0 round(l1).
   * @param {number} s0 round(l2).
   * @returns {Object} { pr0, ps0, outerScale }.
   * @private
   */
  static _poissonWeights (l1, l2, r0, s0) {
    const rawR = DoublyNoncentralBeta._rawPoissonExponent(l1, r0)
    const rawS = DoublyNoncentralBeta._rawPoissonExponent(l2, s0)
    const deferScale = rawR < 700 && rawS < 700 && l1 + l2 < 700
    return {
      pr0: DoublyNoncentralBeta._normalizedWeight(l1, rawR, deferScale),
      ps0: DoublyNoncentralBeta._normalizedWeight(l2, rawS, deferScale),
      outerScale: deferScale ? Math.exp(-l1 - l2) : 1
    }
  }

  /**
   * Unnormalized log-Poisson-weight exponent r*log(l) - logGamma(r+1) (i.e. log(l^r/r!)).
   * Guards l=0: 0*log(0) = NaN by IEEE 754, but the Poisson weight e^0 * 0^0 / 0! = 1, so the
   * exponent is 0 (never actually read downstream: _pdf/_cdf both short-circuit away from this
   * path when lambda=0).
   *
   * @method _rawPoissonExponent
   * @memberof ran.dist.DoublyNoncentralBeta
   * @param {number} l lambda / 2.
   * @param {number} r round(l).
   * @returns {number} The unnormalized log-Poisson-weight exponent.
   * @private
   */
  static _rawPoissonExponent (l, r) {
    return l === 0 ? 0 : r * Math.log(l) - logGamma(r + 1)
  }

  /**
   * exp(raw) if deferring exp(-l) to _pdf/_cdf's outerScale is safe, otherwise exp(raw - l)
   * (folding -l in directly) — see _poissonWeights for the full rationale.
   *
   * @method _normalizedWeight
   * @memberof ran.dist.DoublyNoncentralBeta
   * @param {number} l lambda / 2.
   * @param {number} raw The unnormalized log-Poisson-weight exponent from _rawPoissonExponent.
   * @param {boolean} deferScale Whether deferring exp(-l) to a later outerScale multiplication is safe.
   * @returns {number} pr0 or ps0.
   * @private
   */
  static _normalizedWeight (l, raw, deferScale) {
    if (l === 0) {
      return 1
    }
    return Math.exp(deferScale ? raw : raw - l)
  }

  /**
   * Closed-form estimate of where a Poisson(k; lHalf)-weighted Beta-density term (in either the
   * outer r or, by symmetry, the inner s index) peaks as a function of k, holding the other index
   * fixed at crossTotal. Derived by treating k as continuous and setting the log-term's derivative
   * to zero, using the large-k digamma approximation psi(z) ~ log(z): the resulting stationarity
   * condition lHalf*xFactor*(ownShape+k+crossTotal) ~ (k+1)(ownShape+k) is a quadratic in k. Used
   * only to pick a good starting point for the relocated walk (#1102) — the walk's own
   * MAX_SERIES_ITER-wide window and relative convergence check tolerate this being an
   * approximation, not an exact peak locator, the same way _pdfRForward's fixed r0 start already
   * relies on a window with slack rather than landing exactly on the peak.
   *
   * @method _peakIndex
   * @memberof ran.dist.DoublyNoncentralBeta
   * @param {number} lHalf Poisson mean for this index (lambda1/2 for r, lambda2/2 for s).
   * @param {number} xFactor x for the r index, (1 - x) for the s index.
   * @param {number} ownShape alpha for r, beta for s.
   * @param {number} crossTotal beta + (the other index's current value) for r, alpha + r for s.
   * @returns {number} The estimated peak index, floored at 0.
   * @private
   */
  static _peakIndex (lHalf, xFactor, ownShape, crossTotal) {
    const lx = lHalf * xFactor
    const linear = lx - ownShape - 1
    const discriminant = Math.pow(lx + ownShape - 1, 2) + 4 * lx * crossTotal
    return Math.max(0, Math.round((linear + Math.sqrt(discriminant)) / 2))
  }

  /**
   * log Poisson(k; l) = k*log(l) - l - logGamma(k+1), computed directly (not via a recurrence)
   * since _pdfRelocated/_cdfRelocated evaluate isolated (r, s) pairs across a window centered far
   * from the standard walk's r0/s0, not a contiguous sweep from a cached baseline.
   *
   * @method _logPoissonWeight
   * @memberof ran.dist.DoublyNoncentralBeta
   * @param {number} k Poisson index.
   * @param {number} l Poisson mean (lambda/2).
   * @returns {number} The log-domain Poisson weight.
   * @private
   */
  static _logPoissonWeight (k, l) {
    return k * Math.log(l) - l - logGamma(k + 1)
  }
}
