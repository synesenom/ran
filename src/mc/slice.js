import MCMC from './_mcmc'

// Batch length for the w Robbins-Monro adaptation, matching RWM's proposal-scale batch cadence.
const BATCH = 100
// Target ratio of the realized (post-stepping-out) bracket width to w. A ratio near 1 means
// the initial bracket already covers the slice (w is too large, wasting shrinkage draws); a
// ratio far above 1 means many stepping-out steps were needed (w is too small). Targeting 2
// keeps w in the regime Neal (2003) recommends: small enough that stepping-out is exercised,
// large enough that it rarely needs many steps.
const TARGET_RATIO = 2.0
// Caps stepping-out expansion per direction so a pathological density (e.g. one whose slice
// is unexpectedly wide relative to w) cannot loop indefinitely. Not exposed as a tunable — the
// issue scopes only w as configurable. Hitting the cap is safe, not a correctness bug: the
// shrinkage step's lnp(x1) > y check is what guarantees a valid sample, not full slice coverage.
const MAX_STEPS = 200

/**
 * @overload
 * @param {Function} logDensity The logarithm of the (unnormalized) target density.
 * @param {Object=} config Sampler configuration (see MCMC base class for shared options).
 * @param {Object=} initialState Initial state of the sampler (see MCMC base class). The interval
 * width `w` (default 1.0) may be seeded via `initialState.internal.w`, either as a single number
 * (broadcast to every dimension) or as a per-dimension array.
 */
/**
 * @overload
 * @param {Object} options Sampler options, as a single object.
 * @param {Function} options.logDensity The logarithm of the (unnormalized) target density.
 * @param {Object=} options.config Sampler configuration (see MCMC base class for shared options).
 * @param {Object=} options.initialState Initial state of the sampler, including the `w` seeding
 * described in the positional form above.
 */
/**
 * Class implementing coordinate-wise [slice sampling]{@link https://en.wikipedia.org/wiki/Slice_sampling}
 * (Neal, R.M. (2003) "Slice Sampling", Annals of Statistics 31(3):705-767) via the stepping-out
 * and shrinkage procedure. Each sweep updates every dimension in turn: a vertical level is drawn
 * below the current point's density, an interval bracketing the resulting horizontal slice is
 * found by stepping outward in increments of `w`, and a point within that interval is accepted
 * once shrinkage finds one whose density exceeds the vertical level. No proposal distribution or
 * gradient is required, and every sweep produces an accepted draw, so [ar]{@link ran.mc.Slice#ar}
 * is always 1.
 *
 * A prior, non-functional `slice.js` (100% commented out, 1D only, never wired into the base
 * class) was deleted as dead code in PR #615; this is a fresh implementation, not a restoration.
 *
 * @class Slice
 * @memberof ran.mc
 * @param {Function|Object} logDensity The logarithm of the (unnormalized) target density (this
 * positional form is deprecated — see the options-object overload above), or a single options
 * object carrying {logDensity}, {config}, and {initialState}.
 * @param {Object=} config Sampler configuration (see MCMC base class for shared options).
 * @param {Object=} initialState Initial state of the sampler (see MCMC base class). The interval
 * width `w` (default 1.0) may be seeded via `initialState.internal.w`, either as a single number
 * (broadcast to every dimension) or as a per-dimension array.
 * @constructor
 * @throws {Error} If `w` (or any element of a per-dimension `w` array) is not a positive, finite
 * number, or if a per-dimension `w` array's length does not equal `dim`.
 */
// decisions/0020-mcmc-design.md — the _iter/_adjust/_internal contract was designed for exactly
// this pattern: a per-dimension sweep with its own adaptive tunable and no gradient requirement.
// decisions/0030-mcmc-options-object-constructor.md — options-object form, detected by the MCMC base class
export default class Slice extends MCMC {
  /**
   * @param {Function} logDensity The logarithm of the (unnormalized) target density.
   * @param {Object=} config Sampler configuration (see MCMC base class for shared options).
   * @param {Object=} initialState Initial state of the sampler (see MCMC base class). The interval
   * width `w` (default 1.0) may be seeded via `initialState.internal.w`, either as a single number
   * (broadcast to every dimension) or as a per-dimension array.
   */
  constructor (logDensity, config = {}, initialState = {}) {
    super(logDensity, config, initialState)
    const w = this.internal.w
    this._w = Array.isArray(w) ? w.slice() : new Array(this.dim).fill(typeof w === 'number' ? w : 1.0)
    Slice._validateW(this._w, this.dim)
    this._bwSum = new Array(this.dim).fill(0)
    this._adjN = 0
    this._adjBatch = 0
    // Reused across every _iter() call (up to millions per warmUp()/sample() run) instead of
    // reallocating: the base class reads i.bracketWidths synchronously in _adjust() and never
    // retains the result object afterward, so overwriting this array in place is safe.
    this._bracketWidths = new Array(this.dim)
  }

  // ─── PROTECTED INSTANCE ───

  _iter (x) {
    const x1 = x.slice()
    for (let d = 0; d < this.dim; d++) {
      const logY = this.lnp(x1) - (-Math.log(this.r.next()))
      const bracket = this._stepOut(x1, d, logY)
      this._bracketWidths[d] = bracket[1] - bracket[0]
      x1[d] = this._shrink(x1, d, logY, bracket)
    }
    return { x: x1, accepted: true, bracketWidths: this._bracketWidths }
  }

  _adjust (i) {
    for (let d = 0; d < this.dim; d++) {
      this._bwSum[d] += i.bracketWidths[d]
    }
    this._adjN++
    if (this._adjN < BATCH) {
      return
    }
    this._adjBatch++
    const delta = Math.min(0.01, Math.pow(this._adjBatch, -0.5))
    for (let d = 0; d < this.dim; d++) {
      const ratio = this._bwSum[d] / (BATCH * this._w[d])
      this._w[d] *= Math.exp(ratio > TARGET_RATIO ? delta : -delta)
      this._bwSum[d] = 0
    }
    this._adjN = 0
  }

  _internal () {
    return { w: this._w.slice() }
  }

  // The bracket is placed at a uniformly random offset within [0, w) of x0, not flush against
  // it, because a fixed offset would bias which side of the slice gets fewer expansion steps —
  // Neal (2003) requires this randomization for detailed balance to hold.
  _stepOut (x1, d, logY) {
    const w = this._w[d]
    const x0 = x1[d]
    let l = x0 - w * this.r.next()
    let r = l + w
    const at = v => {
      x1[d] = v
      return this.lnp(x1)
    }
    for (let k = 0; k < MAX_STEPS && at(l) > logY; k++) {
      l -= w
    }
    for (let k = 0; k < MAX_STEPS && at(r) > logY; k++) {
      r += w
    }
    x1[d] = x0
    return [l, r]
  }

  // Shrinking toward x0 (rather than, say, halving the interval symmetrically) keeps x0 inside
  // [l, r] at every step, which is what guarantees termination: x0 always satisfies
  // lnp(x0) > logY by construction (logY was drawn strictly below it), so the loop cannot shrink
  // past a valid candidate. This is also required for detailed balance — Neal (2003) Figure 5.
  _shrink (x1, d, logY, bracket) {
    const x0 = x1[d]
    let [l, r] = bracket
    for (;;) {
      const candidate = l + (r - l) * this.r.next()
      x1[d] = candidate
      if (this.lnp(x1) > logY) {
        return candidate
      }
      if (candidate < x0) {
        l = candidate
      } else {
        r = candidate
      }
    }
  }

  // Slice forwards (logDensity, config, initialState) to super() unchanged and has no extra
  // constructor arguments, so the options-object form already matches its real arity — see
  // decisions/0030-mcmc-options-object-constructor.md.
  static get _supportsOptionsConstructor () {
    return true
  }

  // Kept out of the constructor to avoid a Complex Conditional smell there, matching the
  // MCMC base class's _validateDim/_validateMaxLag/_validateArWindow pattern.
  static _validateW (w, dim) {
    if (w.length !== dim || !w.every(Slice._isPositiveNumber)) {
      throw Error('Slice: w must be a positive number or an array of dim positive numbers')
    }
  }

  // Number.isFinite (which also rejects non-numbers) rather than typeof/>0 alone: an infinite w
  // makes _stepOut compute l = x0 - Infinity * U = -Infinity and r = l + Infinity = NaN, and
  // _shrink's loop then draws NaN candidates forever since NaN > logY is always false — an
  // unguarded infinite hang, not just an invalid-input rejection.
  // See solutions/correctness/2026-07-15-1018-slice-sampler-infinite-w-hang.md
  static _isPositiveNumber (w) {
    return Number.isFinite(w) && w > 0
  }
}
