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
 * Class implementing coordinate-wise [slice sampling]{@link https://en.wikipedia.org/wiki/Slice_sampling}
 * (Neal, R.M. (2003) "Slice Sampling", Annals of Statistics 31(3):705-767) via the stepping-out
 * and shrinkage procedure. Each sweep updates every dimension in turn: a vertical level is drawn
 * below the current point's density, an interval bracketing the resulting horizontal slice is
 * found by stepping outward in increments of `w`, and a point within that interval is accepted
 * once shrinkage finds one whose density exceeds the vertical level. No proposal distribution or
 * gradient is required, and every sweep produces an accepted draw, so [ar]{@link ran.mc.SliceSampler#ar}
 * is always 1.
 *
 * A prior, non-functional `slice.js` (100% commented out, 1D only, never wired into the base
 * class) was deleted as dead code in PR #615; this is a fresh implementation, not a restoration.
 *
 * @class SliceSampler
 * @memberof ran.mc
 * @param {Function} logDensity The logarithm of the (unnormalized) target density.
 * @param {Object=} config Sampler configuration (see MCMC base class for shared options).
 * @param {Object=} initialState Initial state of the sampler (see MCMC base class). The interval
 * width `w` (default 1.0) may be seeded via `initialState.internal.w`, either as a single number
 * (broadcast to every dimension) or as a per-dimension array.
 * @constructor
 */
// decisions/0020-mcmc-design.md — the _iter/_adjust/_internal contract was designed for exactly
// this pattern: a per-dimension sweep with its own adaptive tunable and no gradient requirement.
export default class SliceSampler extends MCMC {
  constructor (logDensity, config = {}, initialState = {}) {
    super(logDensity, config, initialState)
    const w = this.internal.w
    this._w = Array.isArray(w) ? w.slice() : new Array(this.dim).fill(typeof w === 'number' ? w : 1.0)
    SliceSampler._validateW(this._w, this.dim)
    this._bwSum = new Array(this.dim).fill(0)
    this._adjN = 0
    this._adjBatch = 0
  }

  // ─── PROTECTED INSTANCE ───

  _iter (x) {
    const x1 = x.slice()
    const bracketWidths = new Array(this.dim)
    for (let d = 0; d < this.dim; d++) {
      const logY = this.lnp(x1) - (-Math.log(this.r.next()))
      const bracket = this._stepOut(x1, d, logY)
      bracketWidths[d] = bracket[1] - bracket[0]
      x1[d] = this._shrink(x1, d, logY, bracket)
    }
    return { x: x1, accepted: true, bracketWidths }
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

  // Places a width-w bracket at random around x1[d], then steps each endpoint outward in
  // increments of w until it falls outside the slice (or MAX_STEPS is reached).
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

  // Repeatedly draws a candidate within [bracket[0], bracket[1]), shrinking the interval toward
  // x1[d] whenever the candidate falls outside the slice, until one is found inside it.
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

  // Kept out of the constructor to avoid a Complex Conditional smell there, matching the
  // MCMC base class's _validateDim/_validateMaxLag/_validateArWindow pattern.
  static _validateW (w, dim) {
    if (w.length !== dim || !w.every(SliceSampler._isPositiveNumber)) {
      throw Error('SliceSampler: w must be a positive number or an array of dim positive numbers')
    }
  }

  static _isPositiveNumber (w) {
    return typeof w === 'number' && w > 0
  }
}
