import clamp from '../utils/clamp'
import Distribution from './_distribution'
import noncentralChi2 from './_noncentral-chi2'
import normal from './_normal'
import { erf, f11, gamma, logGamma } from '../special'
import { recursiveSum } from '../algorithms'
import NoncentralT from './noncentral-t'

/**
 * Probability density function for the [doubly non-central t distribution]{@link https://www.wiley.com/en-us/Intermediate+Probability%3A+A+Computational+Approach-p-9780470026373}:
 *
 * $f(x; \nu, \mu, \theta) = \frac{e^{-\frac{\theta + \mu^2}{2}}}{\sqrt{\pi \nu}} \sum_{j = 0}^\infty \frac{1}{j!} \frac{(x \mu \sqrt{2 / \nu})^j}{(1 + x^2 / \nu)^{\frac{\nu + j + 1}{2}}} \frac{\Gamma\big(\frac{\nu + j + 1}{2}\big)}{\Gamma\big(\frac{\nu}{2}\big)} {}_1F_1\bigg(\frac{\nu + j + 1}{2}, \frac{\nu}{2}; \frac{\theta}{2 (1 + x^2 / \nu)}\bigg),$
 *
 * where $\nu \in \mathbb{N}^+$, $\mu \in \mathbb{R}$ and $\theta > 0$. Support: $x \in \mathbb{R}$.
 *
 * @class DoublyNoncentralT
 * @memberof ran.dist
 * @constructor
 */
export default class DoublyNoncentralT extends Distribution {
  /**
   * @param {number} nu Degrees of freedom. If not an integer, it is rounded to the nearest one.
   * @param {number} mu Location parameter.
   * @param {number} theta Shape parameter.
   */
  constructor (nu, mu, theta) {
    super('continuous', 3)

    // Validate parameters
    const nui = Math.round(nu)
    this.p = { nu: nui, mu, theta }
    Distribution.validate({ nu: nui, mu, theta }, [
      'nu > 0',
      'theta >= 0'
    ])

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    this.c = {
      logScale: -0.5 * (theta + mu * mu + Math.log(Math.PI * nui)) - logGamma(nui / 2),
      expHalfTheta: Math.exp(-theta / 2),
      qSpread: Math.max(10, 5 * (Math.abs(mu) + Math.sqrt(nui) + Math.sqrt(theta)))
    }
  }

  /**
   * Finds the index corresponding to the largest term in a series.
   *
   * @method startIndex
   * @memberof ran.dist.DoublyNoncentralT
   * @param {Function} term Function that accepts an index and returns the term value.
   * @returns {number} The index of the largest term.
   * @private
   */
  _findStartIndex (term) {
    // Find bracket that contains the maximum value.
    let j1 = 1
    let f1 = term(j1)
    let j2 = 2
    let f2 = term(j2)
    let j = 3
    let f = term(j)
    while (f2 >= f1) {
      // Calculate new value: advance index according to a Fibonacci series.
      j = j1 + j2
      f = term(j)

      // Keep advancing the index if new value is larger.
      if (f >= f2) {
        j1 = j2
        j2 = j
        f1 = f2
        f2 = f
      } else {
        break
      }
    }

    // Narrow bracket to find the exact index.
    while (j1 !== j2) {
      // Add bisection point.
      j = Math.floor((j1 + j2) / 2)
      f = term(j)

      // Check if current boundary is small enough.
      if (j === j1 || j === j2) {
        break
      }

      // Update the right index.
      if (f1 > f2) {
        f2 = f
        j2 = j
      } else {
        f1 = f
        j1 = j
      }
    }

    return j
  }

  /**
   * Logarithm of the term in the probability density function.
   *
   * @method _logA
   * @memberof ran.dist.DoublyNoncentralT
   * @param {number} x Value to evaluate density at.
   * @param {number} j Index of the term to evaluate.
   * @returns {number} The logarithm of the term.
   * @private
   */
  _logA (x, j) {
    const tk = 1 + x * x / this.p.nu
    const kj = (this.p.nu + j + 1) / 2
    return j * Math.log(Math.abs(x * this.p.mu / Math.sqrt(this.p.nu / 2))) +
      logGamma(kj) -
      kj * Math.log(tk) -
      logGamma(j + 1) +
      Math.log(f11(kj, this.p.nu / 2, this.p.theta / (2 * tk)))
  }

  /**
   * Difference NoncentralT.fnm(nuHi, mu, xHi) - NoncentralT.fnm(nuLo, mu, xLo), falling back to
   * a NoncentralT.snm (direct survival) difference when either raw fnm call cannot be trusted.
   * fnm's `z / 2 + phi` addition (noncentral-t.js:149, phi = 0.5*(1+erf(-mu/sqrt2)), valid here
   * without a `-delta/sqrt2` distinction since both `hi.x`/`lo.x` are always >= 0 at this call
   * site, collapsing fnm's own `delta = x<0?-mu:mu` to `delta = mu`) can lose precision two
   * distinct ways, and both must be checked -- neither implies the other:
   *   (1) the nu-dependent correction z/2 is too small to separate from phi at all, so fnm
   *       returns phi bit-for-bit (or near-bit-for-bit) unchanged -- caught by comparing each
   *       raw value directly against phi. This needs no nu-magnitude pre-filter: it only fires
   *       when z/2 is genuinely unresolved, which requires y = x^2/(nu+x^2) small enough that the
   *       AS243 series' incomplete-beta terms are themselves negligible, not the O(1)-scale case
   *       .fit()'s optimizer exploration evaluates against sampled data.
   *   (2) z/2 DID resolve (the raw value has moved measurably off phi) but is itself so close to
   *       the opposite boundary (0 or 1) that the double holding it can no longer represent the
   *       gap -- the original #1250 deep-tail case (DoublyNoncentralT(5,5,120) at x=-0.7), where
   *       phi is far from 1 but successive nu0's fnm values climb toward exactly 1.0 as nu grows.
   *       A phi-comparison alone does NOT catch this (the value is deliberately far from phi by
   *       design -- that is what "resolved" means), so the original nu-gated
   *       `lo.nu >= 30 && |diff| < 1e-9` difference-magnitude check is kept for this case
   *       specifically: nu0 >= 30 excludes the small-nu .fit()-exploration regime this threshold
   *       was originally tuned against (see the #1250 solution doc), and |diff| < lo.nu *
   *       Number.EPSILON * 1e10 catches the difference collapsing as nu0 approaches the region
   *       where individual fnm calls saturate to literal 1.0.
   * The magnitude threshold is nu-scaled (issue #1332, porting #1325's identical
   * NoncentralT._pdf fix): fnm's own absolute noise floor grows roughly linearly with nu, and
   * _pdfPoissonMixture multiplies this difference by nu0 (the same amplification structure as
   * NoncentralT._pdf's nu*(a-b)/x), so a flat 1e-9 threshold stopped catching amplified-noise
   * differences once nu0 grew large enough. Confirmed empirically at moderate nu0 (~30-125,
   * reachable by this file's own existing precision-gate tests, e.g. DoublyNoncentralT(5, 2,
   * 120)): the scaled threshold closes a real gap, tightening pdf(x=-0.7)'s relative error from
   * ~1.7e-9 to ~7.3e-15. At nu0 >= ~10000 (unreachable via .fit() or any realistic parameter
   * set) it only partially helps -- _fnmDiff's fallback is NoncentralT.snm(lo) - NoncentralT.snm
   * (hi), itself a difference of two ~1e-11-accurate quadratures, so once the true difference
   * shrinks to a comparable magnitude that fallback re-encounters a smaller-scale version of the
   * same cancellation problem one level down; unlike NoncentralT._pdf's #1325 fallback
   * (_pdfDirect, a single cancellation-free density quadrature), there is no direct-quadrature
   * replacement available for a CDF *difference*. See
   * thoughts/research/2026-08-04-0811-doubly-noncentral-t-nu-scaled-saturation-gate.md and
   * solutions/correctness/2026-08-04-0823-doubly-noncentral-t-nu-scaled-fnmdiff-gate-fix.md for
   * the full investigation, measurements, and the documented residual limit at extreme nu0.
   * Checking (1) closes a blind spot the difference-only gate had (issue #1298): a single
   * "knife-edge" nu0 per x where one of the two fnm calls has resolved and the other hasn't
   * produces a raw difference dominated by the still-stuck operand's own error against phi, which
   * is WRONG but not small (~1e-7, evading the 1e-9 magnitude check on its own).
   * See solutions/correctness/2026-08-01-2030-noncentral-t-fnm-snm-boundary-saturation.md (the
   * predecessor fix (2) preserves) and
   * solutions/correctness/2026-08-02-2100-noncentral-t-fnm-dual-saturation-mechanism.md (the origin of (1))
   *
   * Issue #1317 investigated whether the (1) phi-check above could gain a nu-magnitude
   * pre-filter, mirroring (2)'s `nu0 >= 30` gate, to cut the runtime this check added to
   * test/guess.js's default-pool .fit() sweep (~23-24s pre-#1298 to ~48-52s after). Direct
   * instrumentation of that exact sweep found the small-y regime this check targets -- assumed
   * above to be "not the O(1)-scale case .fit()'s optimizer exploration evaluates" -- is in fact
   * hit constantly: (1) alone fires on ~65% of all _fnmDiff calls, and of the fires (2) does not
   * also catch, 99.96% change the returned difference by more than 1e-12 (one measured case:
   * 5.31e-5 corrected to 3.82e-6, at hi.nu=14, lo.nu=12, x=~0.04-0.045) -- i.e. almost every fire
   * is load-bearing, not defensive. 99.98% of those fires have nu0 < 30, the same low-nu regime
   * `.fit()`'s optimizer explores most (`_fitInit` seeds nu as low as 3) and the regime #1298's
   * own reported case (nu=5) sits in -- so any nu-magnitude gate narrow enough to reduce the fire
   * rate would exclude cases already proven necessary, reopening #1298. No pre-filter was added;
   * the ~48-52s runtime is the accepted steady-state cost of this correctness fix.
   * See solutions/performance/2026-08-02-2148-doubly-noncentral-t-phi-check-not-optimizable.md
   *
   * @method _fnmDiff
   * @memberof ran.dist.DoublyNoncentralT
   * @param {number} mu Non-centrality parameter shared by both calls.
   * @param {Object} hi Minuend fnm call, as { nu, x }.
   * @param {Object} lo Subtrahend fnm call, as { nu, x }.
   * @returns {number} The CDF difference.
   * @private
   */
  _fnmDiff (mu, hi, lo) {
    const phi = 0.5 * (1 + erf(-mu / Math.SQRT2))
    const a = NoncentralT.fnm(hi.nu, mu, hi.x)
    const b = NoncentralT.fnm(lo.nu, mu, lo.x)
    const diff = a - b
    const stuckAtPhi = Math.abs(a - phi) < 1e-12 || Math.abs(b - phi) < 1e-12
    const nearOppositeBoundary = lo.nu >= 30 && Math.abs(diff) < lo.nu * Number.EPSILON * 1e10
    if (stuckAtPhi || nearOppositeBoundary) {
      return NoncentralT.snm(lo.nu, mu, lo.x) - NoncentralT.snm(hi.nu, mu, hi.x)
    }
    return diff
  }

  /**
   * Probability density for the x*mu < 0 branch via a Poisson(theta/2) mixture of noncentral-t
   * densities -- the term-by-term derivative of _cdf's mixture formula below. Every term is a
   * Poisson weight times a difference of two NoncentralT.fnm (CDF) values, never an
   * alternating-sign series term, so there is no cancellation to accelerate away (unlike the
   * deleted wynnEpsilon-based j-series, which could not recover precision already lost between
   * huge, opposite-sign terms).
   * See solutions/correctness/2026-07-31-1300-doubly-noncentral-t-pdf-cancellation-x-mu-negative.md
   *
   * @method _pdfPoissonMixture
   * @memberof ran.dist.DoublyNoncentralT
   * @param {number} x Value to evaluate density at.
   * @returns {number} The signed sum whose absolute value is the density.
   * @private
   */
  _pdfPoissonMixture (x) {
    const y = Math.abs(x)
    const mu = x < 0 ? -this.p.mu : this.p.mu
    const sHi0 = Math.sqrt(1 + 2 / this.p.nu)
    return recursiveSum({
      p: this.c.expHalfTheta,
      nu0: this.p.nu,
      f: this._fnmDiff(mu, { nu: this.p.nu + 2, x: y * sHi0 }, { nu: this.p.nu, x: y })
    }, (t, i) => {
      const i2 = 2 * i
      t.p *= this.p.theta / i2
      t.nu0 = this.p.nu + i2
      const sLo = Math.sqrt(1 + i2 / this.p.nu)
      const sHi = Math.sqrt(1 + (i2 + 2) / this.p.nu)
      t.f = this._fnmDiff(mu, { nu: t.nu0 + 2, x: y * sHi }, { nu: t.nu0, x: y * sLo })
      return t
    }, t => t.p * t.nu0 * t.f, undefined, { useFloor: false }) / y
  }

  _generator () {
    // Direct sampling from a normal and a non-central chi2
    const x = normal(this.r, this.p.mu)
    const y = noncentralChi2(this.r, this.p.nu, this.p.theta)
    return x / Math.sqrt(y / this.p.nu)
  }

  _pdf (x) {
    // Near x = 0 the dominant j = 0 term is dropped by the backward series loop, so collapse to
    // the j=0-only closed form. Threshold matches NoncentralT._pdf convention.
    if (Math.abs(x) < Number.EPSILON) {
      const kj0 = (this.p.nu + 1) / 2
      return Math.exp(this.c.logScale) * gamma(kj0) * f11(kj0, this.p.nu / 2, this.p.theta / 2)
    }

    // When mu = 0, all j > 0 terms in the series carry a factor of mu^j = 0, so only j = 0 survives.
    if (this.p.mu === 0) {
      const tk = 1 + x * x / this.p.nu
      const kj0 = (this.p.nu + 1) / 2
      return Math.exp(this.c.logScale) * gamma(kj0) * f11(kj0, this.p.nu / 2, this.p.theta / (2 * tk)) / Math.pow(tk, kj0)
    }

    // Some pre-computed constants
    const nu2 = this.p.nu / 2
    const tk = 1 + x * x / this.p.nu
    const srtk = Math.sqrt(tk)
    const lntk = Math.log(tk)
    const tmuk = Math.abs(x * this.p.mu / Math.sqrt(nu2))
    const lntmuk = Math.log(tmuk)
    const thetatk = this.p.theta / (2 * tk)

    // Find index with highest amplitude
    const j0 = this._findStartIndex(j => this._logA(x, j))

    // ₁F₁ is evaluated directly (f11()) at every series index below rather than advanced via a
    // three-term contiguous recurrence in its first argument: that recurrence is numerically
    // unstable in both directions once kj grows large relative to nu/2 (see
    // solutions/correctness/2026-07-30-1600-doubly-noncentral-t-pdf-f11-recurrence-instability.md).
    let z = 0
    if (x * this.p.mu >= 0) {
      // Init terms
      let kj0 = (this.p.nu + j0 + 1) / 2
      let gp = Math.exp(this.c.logScale + j0 * lntmuk - logGamma(j0 + 1) - kj0 * lntk)
      let gk0 = gamma(kj0)

      // Forward
      z = recursiveSum({
        gp,
        gk: [
          gk0,
          gamma(kj0 - 0.5)
        ],
        g: gp * gk0,
        f: f11(kj0, nu2, thetatk)
      }, (t, i) => {
        const j = j0 + i
        const j2 = i % 2
        const kj = (this.p.nu + j + 1) / 2
        t.gp *= tmuk / (j * srtk)
        t.gk[j2] *= kj - 1
        t.g = t.gp * t.gk[j2]
        t.f = f11(kj, nu2, thetatk)
        return t
      }, t => t.g * t.f)

      // Backward
      if (j0 > 0) {
        kj0 -= 0.5
        gp *= j0 * srtk / tmuk
        gk0 = gamma(kj0)
        z += recursiveSum({
          gp: gp,
          gk: [
            gk0,
            gamma(kj0 + 0.5)
          ],
          g: gp * gk0,
          f: f11(kj0, nu2, thetatk)
        }, (t, i) => {
          const j = j0 - i
          if (j > 0) {
            const j2 = i % 2
            const kj = (this.p.nu + j) / 2

            t.gp /= tmuk / (j * srtk)
            t.gk[j2] /= kj
            t.g = t.gp * t.gk[j2]
            t.f = f11(kj, nu2, thetatk)
          } else {
            t.g = 0
            t.f = 0
          }
          return t
        }, t => t.g * t.f)
      }
    } else {
      z = this._pdfPoissonMixture(x)
    }

    return Math.abs(z)
  }

  /**
   * Single term of _cdf's Poisson mixture: NoncentralT.fnm(nu0, mu, x) directly for the x >= 0
   * branch (the returned CDF value IS that sum, so no boundary saturation issue arises). For
   * x < 0 the returned value is 1 minus that sum -- accumulating fnm terms and subtracting once
   * at the end throws away all residual precision the moment the sum itself rounds to exactly
   * 1.0 (the same fnm saturation _fnmDiff guards against above), so this instead accumulates the
   * complement termwise. Since the Poisson weights sum to 1, 1 - sum(w_i . fnm_i) =
   * sum(w_i . (1 - fnm_i)) = sum(w_i . snm_i).
   *
   * The complement branch's fallback is gated the same union of two conditions as _fnmDiff's
   * (issue #1298), since a single raw fnm(nu0, mu, x) call can be untrustworthy the same two
   * distinct ways a difference of two calls can be:
   *   (1) raw is stuck at phi = 0.5*(1+erf(-mu/sqrt2)) (`-mu/sqrt2`, not `-delta/sqrt2`, because
   *       x is always >= 0 at this call site, collapsing fnm's own `delta = x<0?-mu:mu` to
   *       `delta = mu`) -- the original `nu0 >= 30 && rawComplement < 1e-9` magnitude gate could
   *       never catch this: an entire low-nu0 saturated range can have its raw complement pinned
   *       at exactly `1-phi` (the mu=5, x=-0.1 case measured ~2.87e-7, comfortably above the
   *       `< 1e-9` threshold on every term, leaving cdf(-0.1) ~14.5x wrong), which a phi-equality
   *       check catches regardless of nu0 since it tests the actual failure condition directly.
   *   (2) raw has resolved off phi but is itself so close to 1 that the double holding it can no
   *       longer represent the true gap -- the original #1250 deep-tail case. A phi-comparison
   *       does not catch this (the value is deliberately far from phi), so the original
   *       `nu0 >= 30 && rawComplement < 1e-9` check is kept for this case specifically.
   * See solutions/correctness/2026-08-01-2030-noncentral-t-fnm-snm-boundary-saturation.md (the
   * predecessor fix (2) preserves) and
   * solutions/correctness/2026-08-02-2100-noncentral-t-fnm-dual-saturation-mechanism.md (the origin of (1))
   *
   * Issue #1317 measured this helper's own (1) fire rate during test/guess.js's default-pool
   * .fit() sweep at ~0.8% (12 of 1500 calls) -- negligible next to _fnmDiff's ~65% above, so
   * _cdfTerm is not a meaningful contributor to the post-#1298 runtime increase. See _fnmDiff's
   * comment for the full firing-rate/necessity analysis and why no nu-magnitude pre-filter was
   * added to either helper's (1) check.
   *
   * @method _cdfTerm
   * @memberof ran.dist.DoublyNoncentralT
   * @param {boolean} complement Whether the x < 0 branch's complement term is needed.
   * @param {number} mu Non-centrality parameter for the fnm/snm call.
   * @param {number} nu0 Degrees of freedom for this Poisson-mixture term.
   * @param {number} x Value to evaluate at.
   * @returns {number} The term's fnm value, or its complement when `complement` is true.
   * @private
   */
  _cdfTerm (complement, mu, nu0, x) {
    const raw = NoncentralT.fnm(nu0, mu, x)
    if (!complement) {
      return raw
    }
    const phi = 0.5 * (1 + erf(-mu / Math.SQRT2))
    const rawComplement = 1 - raw
    const stuckAtPhi = Math.abs(raw - phi) < 1e-12
    const nearOppositeBoundary = nu0 >= 30 && rawComplement < 1e-9
    return (stuckAtPhi || nearOppositeBoundary) ? NoncentralT.snm(nu0, mu, x) : rawComplement
  }

  _cdf (x) {
    // Sum of the product of Poisson weights and single non-central t CDF (or its complement for
    // x < 0, see _cdfTerm above).
    // Source: https://www.wiley.com/en-us/Intermediate+Probability%3A+A+Computational+Approach-p-9780470026373

    const y = Math.abs(x)
    const mu = x < 0 ? -this.p.mu : this.p.mu
    const complement = x < 0
    // useFloor: false -- for large theta, the leading term (expHalfTheta = exp(-theta/2)) can
    // itself underflow below EPS well before the Poisson(theta/2) weight's true peak, which
    // falsely satisfies recursiveSum's default absolute-floor convergence check after 1 term.
    // See solutions/correctness/2026-07-28-1024-doubly-noncentral-t-cdf-recursivesum-absolute-floor-truncation.md
    const s = recursiveSum({
      p: this.c.expHalfTheta,
      nu0: this.p.nu,
      f: this._cdfTerm(complement, mu, this.p.nu, y)
    }, (t, i) => {
      const i2 = 2 * i
      t.p *= this.p.theta / i2
      t.nu0 = this.p.nu + i2
      t.f = this._cdfTerm(complement, mu, t.nu0, y * Math.sqrt(1 + i2 / this.p.nu))
      return t
    }, t => t.p * t.f, undefined, { useFloor: false })
    return clamp(s)
  }

  _qInitialGuess () {
    // Pre-computed spread bypasses the PRNG-seeded fallback in the base class,
    // making _qEstimateRoot — and thus the numerical moments — deterministic.
    return [this.p.mu - this.c.qSpread, this.p.mu + this.c.qSpread]
  }

  static _fitInit (data) {
    // Central T variance ν/(ν-2) → ν; sample mean for μ; θ seeded at 1
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1
    return [variance > 1 ? Math.max(3, Math.round(2 * variance / (variance - 1))) : 3, mean, 1]
  }

  /**
   * Bounds fit()'s Powell search budget, mirroring NoncentralT's/DoublyNoncentralBeta's own
   * `_powellOptions()` (#1063, #1325) rather than the base class's unbounded `{ tol: 1e-8,
   * maxIter: 200 }` default. Issue #1332's nu-scaled `_fnmDiff` gate (see above) fires far more
   * often than the flat `1e-9` threshold it replaced -- not only at extreme nu, but across the
   * entire nu0 >= 30 range whenever a Poisson-mixture term's raw difference falls under the wider
   * scaled threshold -- so a single `.pdf()`/`.cdf()` call under a large-theta trial parameter
   * (summing many Poisson-mixture terms) can now route many of them through the pricier
   * `NoncentralT.snm`-difference fallback. On data that isn't genuinely DoublyNoncentralT-shaped
   * (e.g. VonMises(0,2)-sampled data, the same reproduction case #1325 used), an unbounded search
   * pays this added per-call cost across hundreds of thousands of likelihood evaluations:
   * measured, `DoublyNoncentralT.fit()` on that data went from ~6s pre-#1332 to ~68s post-#1332
   * with an unbounded search, an ~11x regression invisible to any test that only exercises the
   * reported correctness fix's own reproduction case. `tol=1e-2, maxIter=15` (DoublyNoncentralBeta's
   * own values, not NoncentralT's tighter `1e-3` -- this class has one more free parameter and a
   * similarly ridge-shaped likelihood on mismatched data) bounds the same case back to ~18s alone,
   * ~34s inside `guess()`'s full default-pool sweep (matching that sweep's own pre-existing
   * ~24-34s baseline for this exact VonMises reproduction case), while reproducing well-matched-data
   * fits within ordinary finite-sample noise.
   * See solutions/correctness/2026-08-04-0823-doubly-noncentral-t-nu-scaled-fnmdiff-gate-fix.md
   *
   * @method _powellOptions
   * @memberof ran.dist.DoublyNoncentralT
   * @returns {Object} The bounded Powell search options.
   */
  static _powellOptions () {
    return { tol: 1e-2, maxIter: 15 }
  }
}
