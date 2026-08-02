import clamp from '../utils/clamp'
import Distribution from './_distribution'
import noncentralChi2 from './_noncentral-chi2'
import normal from './_normal'
import { f11, gamma, logGamma } from '../special'
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
   * a NoncentralT.snm (direct survival) difference when the result cannot be trusted. Checking
   * how close the raw fnm values are to 0/1 is not the right signal on its own -- that is driven
   * almost entirely by mu (via fnm's leading Phi(-delta) term) and fires even for small, fully
   * accurate nu where fnm has no precision problem at all. The actual failure mode (issue #1250)
   * only occurs once nu grows large enough that fnm's own regularizedBetaIncomplete-derived
   * series carries a real (~1e-13 relative) precision floor -- so the fallback is gated on nu
   * magnitude first, and only then on the raw difference being small enough that this floor
   * could dominate it. Thresholds empirically verified during planning to fully resolve the
   * reported saturation with zero regression to every other precision-gate group, while keeping
   * the ordinary (small-nu) case's fallback rate low enough to not regress fit()-style repeated
   * evaluation -- see solutions/correctness/2026-08-01-2030-noncentral-t-fnm-snm-boundary-saturation.md
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
    const diff = NoncentralT.fnm(hi.nu, mu, hi.x) - NoncentralT.fnm(lo.nu, mu, lo.x)
    if (lo.nu >= 30 && Math.abs(diff) < 1e-9) {
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
   * Gating the expensive snm call on nu0 >= 30 alone is not enough: unlike _fnmDiff's per-call
   * difference, this term is evaluated once per Poisson-mixture index, and nu0 = nu + 2i grows
   * without bound as the series index i advances, so nu0 crosses 30 on nearly every significant
   * term whenever theta is large -- confirmed to regress test/precision-continuous.js's
   * DoublyNoncentralT([5,2,120]) quantile round-trip from sub-second to a 120s mocha timeout.
   * The raw complement's own magnitude must also indicate genuine precision risk (mirroring
   * _fnmDiff's second-stage check, reusing the same 1e-9 threshold) before paying for snm.
   * See solutions/correctness/2026-08-01-2030-noncentral-t-fnm-snm-boundary-saturation.md
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
    const rawComplement = 1 - raw
    return (nu0 >= 30 && rawComplement < 1e-9) ? NoncentralT.snm(nu0, mu, x) : rawComplement
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
}
