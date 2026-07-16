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
export default class Gibbs extends MCMC {
  constructor (conditionals, config = {}, initialState = {}) {
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
}
