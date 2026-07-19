import MCMC from './_mcmc'

/**
 * Class implementing a component-wise (systematic-scan) [Gibbs sampler]{@link https://en.wikipedia.org/wiki/Gibbs_sampling}.
 * Cycles through the dimensions in a fixed order and replaces each in turn with a draw from its
 * full conditional distribution, given the current values of every other dimension. Because each
 * draw comes directly from the exact conditional, there is no accept/reject step: every iteration
 * is accepted and [ar]{@link ran.mc.MCMC#ar} is always 1.
 *
 * @class Gibbs
 * @memberof ran.mc
 * @param {Object} options Sampler options, as a single object.
 * @param {Function[]} options.conditionals Array of samplers, one per dimension. The d-th
 * conditional function is called as `conditionals[d](x, rng)` with the current full state (an
 * array where index d is about to be replaced) and the sampler's own PRNG (exposing
 * `rng.next(): number`, a uniform variate in [0, 1)), and must return a single draw from the full
 * conditional distribution of dimension d given the rest of the state. `seed()` only reproduces a
 * conditional's draws if the conditional actually consumes `rng` for its own randomness (e.g.
 * `rng.next()`); a conditional that ignores `rng` and constructs its own independent generator
 * remains non-reproducible regardless of `seed()` — see decisions/0026-gibbs-seed-rng-threading.md.
 * @param {Object=} options.config Sampler configuration (see MCMC base class for shared options).
 * `dim` defaults to `conditionals.length`; if provided explicitly it must match
 * `conditionals.length`.
 * @param {Object=} options.initialState Initial state of the sampler (see MCMC base class).
 * @constructor
 * @throws {Error} If options is not a plain object, or conditionals is not a non-empty array, or
 * config.dim is provided but does not match conditionals.length.
 */
// decisions/0020-mcmc-design.md — the _iter/_adjust/_internal contract was designed for exactly
// this pattern: a full sweep that is always accepted, with no adaptive state to carry across.
// decisions/0026-gibbs-seed-rng-threading.md — conditionals receive this.r as a second argument
// so seed() can reach conditional-internal randomness for conditionals that opt in.
// solutions/correctness/2026-07-16-0600-gibbs-seed-rng-threading.md — root cause and prevention
// strategy for this seed()/conditional-randomness gap.
// decisions/0030-mcmc-options-object-constructor.md — options-object-only constructor. Gibbs's
// identifying key is `conditionals`, not `logDensity`, and it always forwards a literal `null` to
// super() (see below), so it cannot reuse the generic {logDensity, config, initialState} shape
// RWM/AdaptiveMetropolis/Slice destructure directly — that shape would land the conditionals
// array in `this.lnp`, a slot the base class treats as a callable log-density.
export default class Gibbs extends MCMC {
  /**
   * @param {Object} options Sampler options, as a single object.
   * @param {Function[]} options.conditionals Array of samplers, one per dimension. The d-th
   * function is called as `conditionals[d](x, rng)` with the current full state (an array where
   * index d is about to be replaced) and the sampler's own PRNG (exposing `rng.next(): number`, a
   * uniform variate in [0, 1)), and must return a single draw from the full conditional
   * distribution of dimension d given the rest of the state. `seed()` only reproduces a
   * conditional's draws if the conditional actually consumes `rng` for its own randomness (e.g.
   * `rng.next()`); a conditional that ignores `rng` and constructs its own independent generator
   * remains non-reproducible regardless of `seed()` — see decisions/0026-gibbs-seed-rng-threading.md.
   * @param {Object=} options.config Sampler configuration (see MCMC base class for shared
   * options). `dim` defaults to `conditionals.length`; if provided explicitly it must match
   * `conditionals.length`.
   * @param {Object=} options.initialState Initial state of the sampler (see MCMC base class).
   * @throws {Error} If options is not a plain object, or conditionals is not a non-empty array, or
   * config.dim is provided but does not match conditionals.length.
   */
  constructor (options = {}) {
    Gibbs._validateOptions(options)
    const { conditionals, config = {}, initialState = {} } = options
    if (!Array.isArray(conditionals) || conditionals.length === 0) {
      throw Error('Gibbs: conditionals must be a non-empty array')
    }
    if (config.dim !== undefined && config.dim !== conditionals.length) {
      throw Error('Gibbs: config.dim must match conditionals.length')
    }
    // No joint (unnormalized) density is needed: every draw comes directly from an exact
    // conditional, so the base class's logDensity slot (this.lnp) is unused by _iter. Passing
    // null instead of a placeholder function avoids an unreachable closure that could never be
    // exercised by a test without contradicting the point of a Gibbs sampler.
    super(null, { ...config, dim: conditionals.length }, initialState)
    this._conditionals = conditionals
  }

  // ─── PROTECTED INSTANCE ───

  _iter (x) {
    const x1 = x.slice()
    for (let d = 0; d < this.dim; d++) {
      // Each conditional sees dimensions already updated earlier in this sweep, per the
      // systematic-scan definition (Geman & Geman 1984) — not the pre-sweep state. this.r is
      // passed through (decisions/0026-gibbs-seed-rng-threading.md) so seed() can reach
      // conditional-internal randomness for conditionals that opt in to using it.
      x1[d] = this._conditionals[d](x1, this.r)
    }
    return { x: x1, accepted: true }
  }

  _adjust () {}

  _internal () {
    return {}
  }

  // Kept out of the constructor to avoid a Complex Conditional / Complex Method smell there.
  // Destructuring options directly in the constructor's parameter list would throw a generic,
  // engine-dependent TypeError for null (default parameters only cover undefined) instead of this
  // clear, Gibbs-specific message.
  // See decisions/0032-mala-options-object-only-constructor.md and
  // solutions/correctness/2026-07-18-1147-mala-null-guard-destructured-parameter-gap.md
  static _validateOptions (options) {
    if (!Gibbs._isPlainObject(options)) {
      throw Error('Gibbs: constructor requires an options object: new Gibbs({ conditionals, config, initialState })')
    }
  }

  // Split from _validateOptions so the compound check is a single return expression rather than
  // a branch condition, which is what the Complex Conditional smell flags.
  static _isPlainObject (options) {
    return options !== undefined && options !== null && typeof options === 'object' && !Array.isArray(options)
  }
}
