import Xoshiro128p from '../core/xoshiro'
import { EPS } from '../core/constants'

// Number of interior evaluation points used to bootstrap the very first hull. Three points
// (quartiles of the support) are enough to seed a valid bounded upper/lower hull pair since,
// unlike classical (semi-)infinite-support ARS, a finite bracket needs no tail-decay condition.
const INIT_POINTS = 3

/**
 * Class implementing [Adaptive Rejection Sampling]{@link https://doi.org/10.2307/2347565}
 * (Gilks & Wild, 1992) for a univariate log-concave target density on a finite support bracket.
 * A piecewise-linear upper hull, built from tangent lines to the log-density at a growing set of
 * abscissae, gives a piecewise-exponential sampling envelope; a piecewise-linear lower hull built
 * from the secant lines between the same abscissae gives a cheap "squeeze" test that avoids
 * evaluating the true log-density whenever possible. Every time the true log-density does have to
 * be evaluated, the tested point is added to the abscissa set, tightening both hulls so the
 * acceptance probability increases monotonically as sampling proceeds. Unlike
 * [MCMC]{@link ran.mc.MCMC} and its subclasses, ARS is not a Markov chain: every draw is an exact,
 * independent sample from the target (up to the target being genuinely log-concave), with no
 * warm-up or burn-in.
 *
 * @class ARS
 * @memberof ran.mc
 * @constructor
 */
export default class ARS {
  /**
   * @param {Function} logDensity The logarithm of the (unnormalized) target density.
   * @param {number[]} support The two-element `[lo, hi]` support bracket. Must be finite with
   * `lo < hi`.
   * @param {Function=} derivative The derivative of `logDensity`. Estimated via finite differences
   * when omitted.
   * @throws {Error} If logDensity is not a function, or support is not a `[lo, hi]` array of two
   * finite numbers with `lo < hi`, or derivative is provided but is not a function, or the initial
   * hull already reveals that logDensity is not log-concave.
   */
  constructor (logDensity, support, derivative) {
    ARS._validate(logDensity, support, derivative)

    this._h = logDensity
    this._dh = derivative
    this._lo = support[0]
    this._hi = support[1]
    this.r = new Xoshiro128p()

    const w = this._hi - this._lo
    this._pts = Array.from({ length: INIT_POINTS }, (_, i) => {
      const x = this._lo + w * (i + 1) / (INIT_POINTS + 1)
      return { x, h: this._h(x), dh: this._slope(x) }
    })
    this._build()
  }

  // ─── PUBLIC INSTANCE ───

  /**
   * Draws samples from the target density.
   *
   * @method sample
   * @memberof ran.mc.ARS
   * @param {number} n Number of samples to generate.
   * @returns {number[]} The generated samples.
   * @throws {Error} If the target density turns out not to be log-concave.
   */
  sample (n) {
    const samples = new Array(n)
    for (let i = 0; i < n; i++) {
      // Unbounded loop: each rejection strictly tightens the hull around the true density, so
      // the acceptance probability strictly improves and termination is guaranteed for a
      // genuinely log-concave target.
      for (;;) {
        const { x, upper } = this._sampleEnvelope()
        const w = this.r.next()

        // Squeeze test: accept without touching the true log-density whenever the candidate
        // falls under the cheap lower (secant) hull relative to the upper (tangent) hull.
        if (w <= Math.exp(this._lowerHull(x) - upper)) {
          samples[i] = x
          break
        }

        const h = this._h(x)
        const dh = this._slope(x)
        this._insert(x, h, dh)
        if (w <= Math.exp(h - upper)) {
          samples[i] = x
          break
        }
      }
    }
    return samples
  }

  /**
   * Sets the seed for the sampler's pseudo random number generator.
   *
   * @method seed
   * @memberof ran.mc.ARS
   * @param {number|string} value The value of the seed, either a number or a string (for the ease
   * of tracking seeds).
   * @returns {this} Reference to the current sampler.
   */
  seed (value) {
    this.r.seed(value)
    return this
  }

  // ─── PRIVATE INSTANCE ───

  // Central difference with a relative step, one-sided near the support boundaries. The
  // Math.cbrt(EPS) scaling balances truncation error (O(step^2)) against rounding error
  // (O(EPS/step)) for the central case, and is reused as the log-concavity check's tolerance
  // since it is also this method's own noise floor.
  _slope (x) {
    if (this._dh) return this._dh(x)
    const e = Math.max(Math.abs(x), 1) * Math.cbrt(EPS)
    if (x - e < this._lo) return (this._h(x + e) - this._h(x)) / e
    if (x + e > this._hi) return (this._h(x) - this._h(x - e)) / e
    return (this._h(x + e) - this._h(x - e)) / (2 * e)
  }

  // Closed-form x-coordinate where the tangent lines at pi and pj (pi.x < pj.x) intersect —
  // the breakpoint between their upper-hull segments. Falls back to the midpoint when the two
  // slopes are numerically indistinguishable, avoiding division by ~0.
  _tangentIntersection (pi, pj) {
    const denom = pi.dh - pj.dh
    if (Math.abs(denom) < EPS) {
      return (pi.x + pj.x) / 2
    }
    return (pj.h - pi.h - pj.x * pj.dh + pi.x * pi.dh) / denom
  }

  // Checks the two signatures a genuinely concave h leaves on a pair of tangent lines: (1) the
  // slope must be non-increasing from pi to pj, and (2) — the more sensitive of the two, since a
  // sparsely-sampled non-concave function can still show a monotone slope pair while its
  // intersection escapes the bracketing interval entirely — the tangents must cross strictly
  // between pi.x and pj.x. Either violation means the "upper hull" would no longer bound the
  // true density, so sampling from it would be silently wrong rather than merely inefficient.
  // See solutions/algorithm/2026-07-15-1043-ars-hull-validity-needs-breakpoint-bracket-check.md
  _assertValidHullSegment (pi, pj, z) {
    const tol = Math.cbrt(EPS) * Math.max(1, Math.abs(pi.x), Math.abs(pj.x), Math.abs(pi.dh), Math.abs(pj.dh))
    const slopeIncreased = pi.dh < pj.dh - tol
    const breakpointOutOfRange = z < pi.x - tol || z > pj.x + tol
    if (slopeIncreased || breakpointOutOfRange) {
      throw Error('ARS: density is not log-concave')
    }
  }

  // Rebuilds the breakpoints and piecewise-exponential segment masses from the current sorted
  // abscissae. Segment masses are computed relative to M = max(h) so exp() stays in a safe
  // numeric range; the shift cancels in every ratio used downstream (segment selection and
  // within-segment inversion), so it is never undone.
  _build () {
    const pts = this._pts
    const k = pts.length
    const z = new Array(k + 1)
    z[0] = this._lo
    z[k] = this._hi
    for (let i = 1; i < k; i++) {
      z[i] = this._tangentIntersection(pts[i - 1], pts[i])
      this._assertValidHullSegment(pts[i - 1], pts[i], z[i])
    }

    const M = Math.max(...pts.map(p => p.h))
    const mass = new Array(k)
    const cum = new Array(k)
    let total = 0
    for (let i = 0; i < k; i++) {
      const p = pts[i]
      const scale = Math.exp(p.h - M)
      const segment = Math.abs(p.dh) < EPS
        ? scale * (z[i + 1] - z[i])
        : scale * (Math.exp(p.dh * (z[i + 1] - p.x)) - Math.exp(p.dh * (z[i] - p.x))) / p.dh
      total += segment
      mass[i] = segment
      cum[i] = total
    }

    this._z = z
    this._mass = mass
    this._cum = cum
    this._total = total
    this._M = M
  }

  // Draws a candidate from the piecewise-exponential envelope via inverse-CDF: pick a segment
  // by binary-searching the cumulative mass, then invert the exponential (or, for a near-zero
  // slope, uniform) segment CDF in closed form. Returns the upper-hull value at the draw point
  // captured now, since the accept test must compare against the hull actually sampled from —
  // not the tightened hull that may exist after a subsequent insertion.
  _sampleEnvelope () {
    const u = this.r.next() * this._total
    let lo = 0
    let hi = this._mass.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (this._cum[mid] < u) lo = mid + 1
      else hi = mid
    }

    const p = this._pts[lo]
    const zLeft = this._z[lo]
    const into = Math.min(Math.max(u - (lo === 0 ? 0 : this._cum[lo - 1]), 0), this._mass[lo])
    const scale = Math.exp(p.h - this._M)

    const x = Math.abs(p.dh) < EPS
      ? zLeft + into / scale
      : p.x + Math.log(Math.exp(p.dh * (zLeft - p.x)) + into * p.dh / scale) / p.dh

    return { x, upper: p.h + (x - p.x) * p.dh }
  }

  // Piecewise-linear lower hull from the secant lines between consecutive abscissae. Returns
  // -Infinity outside the abscissae's own span, where no lower bound is available — the squeeze
  // test then always defers to the true log-density, which is correct at the domain edges.
  _lowerHull (x) {
    const pts = this._pts
    const k = pts.length
    if (x <= pts[0].x || x >= pts[k - 1].x) {
      return -Infinity
    }

    let lo = 0
    let hi = k - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (pts[mid].x <= x) lo = mid
      else hi = mid
    }

    const a = pts[lo]
    const b = pts[hi]
    return a.h + (x - a.x) * (b.h - a.h) / (b.x - a.x)
  }

  // Inserts a newly-evaluated point into the sorted abscissa set and rebuilds the hull. Every
  // insertion is a point where the true log-density was just evaluated, so this is exactly the
  // adaptive tightening step that gives ARS its name.
  _insert (x, h, dh) {
    const pts = this._pts
    let lo = 0
    let hi = pts.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (pts[mid].x < x) lo = mid + 1
      else hi = mid
    }
    pts.splice(lo, 0, { x, h, dh })
    this._build()
  }

  // ─── PRIVATE STATIC ───

  static _validate (logDensity, support, derivative) {
    if (typeof logDensity !== 'function') {
      throw Error('ARS: logDensity must be a function')
    }
    if (!ARS._isValidSupport(support)) {
      throw Error('ARS: support must be a [lo, hi] array of two finite numbers with lo < hi')
    }
    if (derivative !== undefined && typeof derivative !== 'function') {
      throw Error('ARS: derivative must be a function')
    }
  }

  static _isValidSupport (support) {
    return Array.isArray(support) && support.length === 2 &&
      Number.isFinite(support[0]) && Number.isFinite(support[1]) && support[0] < support[1]
  }
}
