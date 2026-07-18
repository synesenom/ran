import MCMC from './_mcmc'

/**
 * @overload
 * @param {Function[]} conditionals Array of samplers, one per dimension (this positional form is
 * deprecated — see the options-object overload below).
 * @param {Object=} config Sampler configuration (see MCMC base class for shared options). `dim`
 * defaults to `conditionals.length`; if provided explicitly it must match `conditionals.length`.
 * @param {Object=} initialState Initial state of the sampler (see MCMC base class).
 */
/**
 * @overload
 * @param {Object} options Sampler options, as a single object.
 * @param {Function[]} options.conditionals Array of samplers, one per dimension (see the
 * positional form).
 * @param {Object=} options.config Sampler configuration (see the positional form).
 * @param {Object=} options.initialState Initial state of the sampler (see the positional form).
 */
/**
 * Class implementing a component-wise (systematic-scan) [Gibbs sampler]{@link https://en.wikipedia.org/wiki/Gibbs_sampling}.
 * Cycles through the dimensions in a fixed order and replaces each in turn with a draw from its
 * full conditional distribution, given the current values of every other dimension. Because each
 * draw comes directly from the exact conditional, there is no accept/reject step: every iteration
 * is accepted and [ar]{@link ran.mc.MCMC#ar} is always 1.
 *
 * @class Gibbs
 * @memberof ran.mc
 * @param {Function[]|Object} conditionals Array of samplers, one per dimension (this positional
 * form is deprecated — see the options-object overload above), or a single options object
 * carrying {conditionals}, {config}, and {initialState}. The d-th conditional function is called
 * as `conditionals[d](x, rng)` with the current full state (an array where index d is about to be
 * replaced) and the sampler's own PRNG (exposing `rng.next(): number`, a uniform variate in
 * [0, 1)), and must return a single draw from the full conditional distribution of dimension d
 * given the rest of the state. `seed()` only reproduces a conditional's draws if the conditional
 * actually consumes `rng` for its own randomness (e.g. `rng.next()`); a conditional that ignores
 * `rng` and constructs its own independent generator remains non-reproducible regardless of
 * `seed()` — see decisions/0026-gibbs-seed-rng-threading.md.
 * @param {Object=} config Sampler configuration (see MCMC base class for shared options). `dim`
 * defaults to `conditionals.length`; if provided explicitly it must match `conditionals.length`.
 * @param {Object=} initialState Initial state of the sampler (see MCMC base class).
 * @constructor
 * @throws {Error} If conditionals is not a non-empty array, or config.dim is provided but does not
 * match conditionals.length.
 */
// decisions/0020-mcmc-design.md — the _iter/_adjust/_internal contract was designed for exactly
// this pattern: a full sweep that is always accepted, with no adaptive state to carry across.
// decisions/0026-gibbs-seed-rng-threading.md — conditionals receive this.r as a second argument
// so seed() can reach conditional-internal randomness for conditionals that opt in.
// solutions/correctness/2026-07-16-0600-gibbs-seed-rng-threading.md — root cause and prevention
// strategy for this seed()/conditional-randomness gap.
// decisions/0030-mcmc-options-object-constructor.md — options-object form. Gibbs's identifying
// key is `conditionals`, not `logDensity`, and it always forwards a literal `null` to super() (see
// below), so it cannot reuse MCMC._resolveConstructorArgs the way RWM/AdaptiveMetropolis/Slice do:
// that helper's return shape would land the conditionals array in `this.lnp`, a slot the base
// class treats as a callable log-density. Detection and the deprecation warning are handled
// locally in Gibbs._resolveGibbsConstructorArgs below instead.
export default class Gibbs extends MCMC {
  /**
   * @param {Function[]} conditionals Array of samplers, one per dimension. The d-th function is
   * called as `conditionals[d](x, rng)` with the current full state (an array where index d is
   * about to be replaced) and the sampler's own PRNG (exposing `rng.next(): number`, a uniform
   * variate in [0, 1)), and must return a single draw from the full conditional distribution of
   * dimension d given the rest of the state. `seed()` only reproduces a conditional's draws if the
   * conditional actually consumes `rng` for its own randomness (e.g. `rng.next()`); a conditional
   * that ignores `rng` and constructs its own independent generator remains non-reproducible
   * regardless of `seed()` — see decisions/0026-gibbs-seed-rng-threading.md.
   * @param {Object=} config Sampler configuration (see MCMC base class for shared options). `dim`
   * defaults to `conditionals.length`; if provided explicitly it must match `conditionals.length`.
   * @param {Object=} initialState Initial state of the sampler (see MCMC base class).
   * @throws {Error} If conditionals is not a non-empty array, or config.dim is provided but does not
   * match conditionals.length.
   */
  constructor (conditionals, config = {}, initialState = {}) {
    const resolved = Gibbs._resolveGibbsConstructorArgs(conditionals, config, initialState)
    conditionals = resolved.conditionals
    config = resolved.config
    initialState = resolved.initialState
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

  // Detects the options-object constructor form (a single { conditionals, config, initialState }
  // argument) vs. the legacy positional form, mirroring MCMC._resolveConstructorArgs's own
  // detection style but keyed on `conditionals` instead of `logDensity` — see the class-level
  // decisions/0030-mcmc-options-object-constructor.md comment above for why this can't live in
  // the shared base-class helper. Named distinctly from MCMC._resolveConstructorArgs (not an
  // override) since the two have incompatible return shapes ({conditionals, ...} vs.
  // {logDensity, ...}); reusing the same name would make Gibbs's static side incompatible with
  // MCMC's per TypeScript's static-side inheritance check (tsc error TS2417). The warning fires
  // once per instantiation, matching the RWM/AdaptiveMetropolis/Slice deprecation-cycle contract
  // (same message prefix and removal version), even though Gibbs never reaches
  // MCMC._supportsOptionsConstructor's own gate (Gibbs always passes `null` as `logDensity` to
  // super(), so that gate is a no-op for Gibbs either way).
  static _resolveGibbsConstructorArgs (conditionals, config, initialState) {
    // !Array.isArray guards against a crafted positional array carrying its own `conditionals`
    // own-property (legal in JS: arrays can hold arbitrary properties) being misdetected as the
    // options-object form — typeof [] === 'object' alone isn't enough to rule that out, unlike
    // MCMC._resolveConstructorArgs's logDensity check, where the positional type (Function) is
    // never typeof 'object' to begin with.
    const isOptionsForm = conditionals !== null && typeof conditionals === 'object' &&
      !Array.isArray(conditionals) &&
      Object.prototype.hasOwnProperty.call(conditionals, 'conditionals')
    if (isOptionsForm) {
      return {
        conditionals: conditionals.conditionals,
        config: conditionals.config || {},
        initialState: conditionals.initialState || {}
      }
    }
    // Fired once per instantiation (not once per process) so every positional-form call site
    // is visible in the console, not just the first — matches MCMC._resolveConstructorArgs.
    console.warn('[ranjs] positional MCMC constructor arguments are deprecated and will be removed in v1.32.0; use new Gibbs({ conditionals, config, initialState }) instead.')
    return { conditionals, config, initialState }
  }
}
