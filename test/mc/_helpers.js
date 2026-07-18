import { assert } from 'chai'

// ksTest's critical value (test/test-utils.js) is the standard two-sided KS asymptotic
// constant at alpha=0.01 (D <= 1.628/sqrt(n)) -- every unseeded call has an inherent ~1%
// false-positive rate per CI run. Every distributional/margin-recovery KS assertion in this
// file therefore sweeps a fixed, pre-verified seed set -- [0, 42, 12345] (or, for Gibbs,
// [0, 7, 42] -- see that block's own comment for why) -- instead of relying on a single seed,
// so a real regression must break at least one of three independent trajectories reproducibly
// instead of the whole block carrying a permanent flake rate or, worse, having its seed
// hand-picked because it happened to pass. See
// solutions/testing/2026-07-15-1044-ars-unseeded-ks-test-flake-fixed-seeds.md,
// solutions/testing/2026-07-15-2015-gibbs-conditionals-fresh-normal-seed-noop.md, and
// solutions/testing/2026-07-17-1615-mcmc-ks-test-seed-sweep-file-wide-policy.md
export const SEEDS = [0, 42, 12345]

// Shared assertion body for assertConstructorFormsMatch/assertGradientConstructorFormsMatch --
// factored out so the two wrappers (one per constructor arity) don't duplicate the actual
// comparison logic. Verifies the options-object form yields an identical sampler to the
// positional form: same resolved config, same initial position, same serialized internal state
// (RWM's proposal, Slice's w, ...), and the same first iteration once both are seeded alike.
export function assertSamplerParity (positional, options) {
  assert.strictEqual(options.dim, positional.dim)
  assert.strictEqual(options.maxLag, positional.maxLag)
  assert.strictEqual(options._arWindow, positional._arWindow)
  assert.deepStrictEqual(options.x, positional.x)
  assert.deepStrictEqual(options.state().internal, positional.state().internal)
  options.seed(11)
  positional.seed(11)
  assert.deepStrictEqual(options.iterate(), positional.iterate())
}

// Shared parity check for a migrated sampler's two constructor forms, reused by every sampler's
// options-object block (RWM, Slice, ...) so the assertion lives in exactly one place.
// maxLag/arWindow are intentionally left out of `config` by callers so a match can only happen if
// _resolveConstructorArgs threads the options-form config through _resolveConfig's defaulting the
// same way the positional form does — a pass-through-only comparison couldn't catch that.
export function assertConstructorFormsMatch (Ctor, logDensity, config, initialState) {
  const positional = new Ctor(logDensity, config, initialState)
  const options = new Ctor({ logDensity, config, initialState })
  assertSamplerParity(positional, options)
}
