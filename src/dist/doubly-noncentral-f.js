import DoublyNoncentralBeta from './doubly-noncentral-beta'
import noncentralChi2 from './_noncentral-chi2'
import powell from '../algorithms/powell'
import neumaier from '../algorithms/neumaier'
import Distribution from './_distribution'

/**
 * Probability density function for the [doubly non-central F distribution]{@link https://doi.org/10.1111/j.1467-842X.1965.tb00036.x}:
 *
 * $f(x; d_1, d_2, \lambda_1, \lambda_2) = \frac{d_1}{d_2} e^{-\frac{\lambda_1 + \lambda_2}{2}} \sum\_{k = 0}^\infty \sum\_{l = 0}^\infty \frac{\big(\frac{\lambda_1}{2}\big)^k}{k!} \frac{\big(\frac{\lambda_2}{2}\big)^l}{l!} \frac{\big(\frac{d_1 x}{d_2}\big)^{\frac{d_1}{2} + k - 1}}{\big(1 + \frac{d_1 x}{d_2}\big)^{\frac{d_1 + d_2}{2} + k + l}} \frac{1}{\mathrm{B}\big(\frac{d_1}{2} + k, \frac{d_2}{2} + l\big)},$
 *
 * where $d_1, d_2 \in \mathbb{N}^+$ and $\lambda_1, \lambda_2 \ge 0$. Support: $x > 0$.
 *
 * @class DoublyNoncentralF
 * @memberof ran.dist
 * @constructor
 */
export default class DoublyNoncentralF extends DoublyNoncentralBeta {
  // Transformation of double non-central beta
  /**
   * @param {number} d1 First degrees of freedom. If not an integer, it is rounded to the nearest one.
   * @param {number} d2 Second degrees of freedom. If not an integer, it is rounded to the nearest one.
   * @param {number} lambda1 First non-centrality parameter.
   * @param {number} lambda2 Second non-centrality parameter.
   */
  constructor (d1, d2, lambda1, lambda2) {
    const d1i = Math.round(d1)
    const d2i = Math.round(d2)
    super(d1i / 2, d2i / 2, lambda1, lambda2)

    // decisions/0039-reparametrizing-subclass-nontrivial-parent-delegate.md — DoublyNoncentralBeta's
    // _pdf/_cdf (plus six private helpers) are non-trivial series algorithms reading this.p.alpha/
    // this.p.beta throughout, not a one-liner; cache a correctly-parameterized DoublyNoncentralBeta
    // instance and delegate to it instead of duplicating its internals or rewriting
    // DoublyNoncentralBeta itself. d1/d2 are rounded above, before any use, so this delegate,
    // this.p below, and super()'s own this.p/this.c all agree on the same values (#1084). Powell's
    // fit() search still needs a continuous surface to converge efficiently against the ridge
    // #1063 guards against, so static fit() below searches DoublyNoncentralBeta space directly
    // instead of rounding on every trial evaluation.
    this.dncBeta = new DoublyNoncentralBeta(d1i / 2, d2i / 2, lambda1, lambda2)

    this.p = { d1: d1i, d2: d2i, lambda1: this.p.lambda1, lambda2: this.p.lambda2 }

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  /** @inheritdoc */
  static fit (data) {
    // Powell explores DoublyNoncentralBeta's continuous alpha/beta space directly, never
    // constructing a rounding DoublyNoncentralF mid-search — but unlike the pre-#1084 buggy
    // objective (whose own rounded/raw inconsistency accidentally damped this), a fully
    // consistent continuous objective keeps improving along #1063's near-flat d2/lambda1/lambda2
    // ridge almost indefinitely, at ever-increasing per-call cost as DoublyNoncentralBeta's
    // Poisson-mixing series is followed further out. Two smooth squared-hinge barriers below —
    // zero inside a plausible region, growing quadratically only beyond it — discourage this
    // without ever excluding any finite value outright (Powell can still reach a distant optimum
    // if the log-likelihood gain justifies the growing cost, so genuinely large-parameter data is
    // never silently underfit), in the same spirit as Beta._fitPenalty's Jeffreys log-barrier
    // (decisions/0017-beta-fit-penalty.md) but with a zero-penalty region instead of none:
    // - d1/d2: relative to the moment-matched _fitInit guess x0 (log-ratio, so a 10x deviation
    //   either way is free).
    // - lambda1/lambda2: relative to an ABSOLUTE threshold instead of x0 — _fitInit's lambda
    //   estimate floors at 1e-3 whenever the moment-matched value is non-positive (common even
    //   for well-matched, modest-lambda data), which would make any realistic lambda look
    //   implausibly far from x0 in log-ratio terms and wrongly penalize legitimate fits.
    //   r0 = round(lambda/2) is DoublyNoncentralBeta's Poisson-mixing summation index: cost grows
    //   well before its MAX_ITER=100 hard cap, since convergence needs exploring roughly a full
    //   Poisson standard deviation's (sqrt(r0)) worth of terms around the mode. RIDGE_LAMBDA_THRESHOLD
    //   is empirically calibrated (matching this codebase's DoublyNoncentralBeta._powellOptions()
    //   precedent, itself an empirically-tuned budget) against three checks: #1063's pathological
    //   dataset (this file's own dist-base-fit-1.js test) stays well under both its 200000-call
    //   ceiling and 40s timeout with real margin; the well-matched fit-recovery case
    //   (dist-cases-continuous.js's [3,8,1,1] entry) is unaffected; and a genuinely large-lambda
    //   well-matched case (d1=5,d2=10,lambda1=lambda2=50) still recovers a fit whose log-likelihood
    //   matches the unconstrained optimum (confirming large legitimate lambda is not silently
    //   underfit by this threshold, just costlier to reach).
    // See solutions/performance/2026-07-22-0702-doubly-noncentral-fit-powell-ridge-cost.md and
    // solutions/correctness/2026-07-22-1955-doubly-noncentral-f-rounding-fix-broke-fit-ridge-guard.md
    // (the latter documents why "the search surface stays smooth" was NOT a safe assumption here —
    // the pre-#1084 bug this file fixes was itself an accidental stabilizer for this exact ridge).
    const x0 = DoublyNoncentralF._fitInit(data)
    const RIDGE_LOG_RADIUS = Math.log(10)
    const RIDGE_LAMBDA_THRESHOLD = 15
    const RIDGE_PENALTY = 30
    const hinge2 = excess => Math.max(0, excess) ** 2
    const objective = ([d1, d2, lambda1, lambda2]) => {
      try {
        const beta = new DoublyNoncentralBeta(d1 / 2, d2 / 2, lambda1, lambda2)
        const lnL = neumaier(data.map(x => Math.log(x > 0 ? DoublyNoncentralF._fPdf(beta, d1, d2, x) : 0)))
        const ridgePenalty = RIDGE_PENALTY * (
          hinge2(Math.abs(Math.log(d1 / x0[0])) - RIDGE_LOG_RADIUS) +
          hinge2(Math.abs(Math.log(d2 / x0[1])) - RIDGE_LOG_RADIUS) +
          hinge2(lambda1 - RIDGE_LAMBDA_THRESHOLD) +
          hinge2(lambda2 - RIDGE_LAMBDA_THRESHOLD)
        )
        const v = -lnL + ridgePenalty + DoublyNoncentralF._fitPenalty(beta)
        return Number.isFinite(v) ? v : Infinity
      } catch (_) {
        return Infinity
      }
    }
    const best = powell(objective, Distribution._feasibleStart(objective, x0), DoublyNoncentralF._powellOptions())
    return new DoublyNoncentralF(...best)
  }

  _generator () {
    // Direct sampling by transforming a doubly non-central beta. Reimplemented against this.r
    // directly (mirroring DoublyNoncentralBeta.prototype._generator) rather than delegating to
    // the cached this.dncBeta, which owns its own independent PRNG stream.
    const x = noncentralChi2(this.r, this.p.d1, this.p.lambda1)
    const y = noncentralChi2(this.r, this.p.d2, this.p.lambda2)
    const z = x / (x + y)
    const beta = z === 1 ? 1 - y / x : z
    return this.p.d2 * beta / (this.p.d1 * (1 - beta))
  }

  _pdf (x) {
    return DoublyNoncentralF._fPdf(this.dncBeta, this.p.d1, this.p.d2, x)
  }

  _cdf (x) {
    return this.dncBeta._cdf(x / (this.p.d2 / this.p.d1 + x))
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    return this.p.d2 > 6 ? super.skewness() : Infinity
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    return this.p.d2 > 8 ? super.kurtosis() : Infinity
  }

  _afterLoad () {
    // Reconstructed from this.p.d1/d2 — the same rounded values the pre-save delegate was built
    // from (#1084), so a save()+load() round trip reproduces identical pdf()/cdf()/sample().
    this.dncBeta = new DoublyNoncentralBeta(this.p.d1 / 2, this.p.d2 / 2, this.p.lambda1, this.p.lambda2)
  }

  static _fitInit (data) {
    // Central F moment matching for d1, d2; total λ split symmetrically between λ1 and λ2
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1
    const d2 = mean > 1 ? Math.max(3, Math.round(2 * mean / (mean - 1))) : 5
    const d1formula = d2 > 4
      ? Math.round(2 * d2 * d2 * (d2 - 2) / (variance * (d2 - 2) ** 2 * (d2 - 4) - 2 * d2 * d2))
      : 0
    const d1 = d1formula > 0 && isFinite(d1formula) ? Math.max(1, d1formula) : d2
    const lambda = Math.max(1e-3, mean * d1 * (d2 - 2) / d2 - d1) / 2
    return [d1, d2, lambda, lambda]
  }

  // Beta-to-F Jacobian transform, shared by _pdf and static fit()'s objective so the formula
  // cannot drift out of sync between an instance's own density and the value fit() optimizes.
  static _fPdf (betaInst, d1, d2, x) {
    const n = d1 / d2
    return n * betaInst._pdf(x / (1 / n + x)) / Math.pow(1 + n * x, 2)
  }
}
