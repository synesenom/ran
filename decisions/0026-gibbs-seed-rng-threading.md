# ADR-0026: Gibbs Conditionals Receive the Sampler's PRNG as a Second Argument

**Date**: 2026-07-15
**Status**: Accepted

## Context

`ran.mc.Gibbs` (added in #821, `src/mc/gibbs.js`) extends `MCMC` and inherits `seed(value)`, whose JSDoc on the base class (`src/mc/_mcmc.js:53-62`) promises "seed the PRNG for reproducible chains." `Gibbs._iter()` never reads `this.r` — every per-iteration draw comes from calling `this._conditionals[d](x1)`, an opaque, caller-supplied closure. Real conditionals typically construct or capture their own `Distribution` instance (e.g. `x => new Normal(rho * x[1], sigma).sample()`), which — per `src/core/xoshiro.js` — seeds itself from `Math.random()` unless the caller explicitly seeds it. `MCMC.seed()`/`Gibbs`'s inherited `seed()` has no way to reach into that closure, so `gibbs.seed(42).sample(null, N)` called twice does not produce identical output, silently violating the documented contract.

This gap was already hit once at the test level: `solutions/testing/2026-07-15-2015-gibbs-conditionals-fresh-normal-seed-noop.md` documents a CI flake caused by exactly this issue and explicitly calls for a design-level follow-up rather than a further test-only workaround. Issue #938 is that follow-up, posing two directions: (A) extend the conditional contract so `Gibbs.seed()` can reach conditional-internal randomness, or (B) override `Gibbs.seed()` to throw, converting the silent violation into a documented hard error.

`RWM.seed()` (`src/mc/rwm.js:58-65`) is the existing precedent for a subclass that owns additional randomness sources: it reseeds both `this.r` (via `super.seed()`) and its internally-owned `this._q` proposal generator with the same value. `AdaptiveMetropolis` and `HMC` follow the same override-and-reseed-internal-object pattern. `Gibbs` has no internal object analogous to `_q` — its randomness lives entirely inside caller-supplied closures — so the RWM pattern cannot be applied directly without first giving conditionals a way to draw from a sampler-owned, reseedable source.

Three concrete options were evaluated:
- **Thread `this.r` into conditionals** as `conditionals[d](x, rng)`. No `seed()` override needed — `Gibbs` already inherits `MCMC.seed()`, which reseeds `this.r`, the same object now passed through. Existing single-argument conditionals silently ignore the extra argument (additive, not breaking) and remain non-reproducible unless they adopt it.
- **Throw from `seed()`**, documenting that reproducibility is the caller's responsibility. Smallest code footprint but does not provide any path to the reproducibility the issue asks for, and makes `Gibbs` the only `MCMC` subclass whose `seed()` does not work.
- **Duck-typed `.seed()` protocol on conditionals** — `Gibbs.seed()` would call `.seed(value)` on any conditional exposing one. No precedent in the codebase for attaching methods to function objects; unnatural in the conditional-as-closure style already established by `Gibbs`'s existing tests and JSDoc, and produces a partial-reproducibility footgun when only some conditionals in an array are seedable.

## Decision

`Gibbs._iter()` calls each conditional with the current state **and** the sampler's own PRNG: `this._conditionals[d](x1, this.r)`. No `Gibbs.seed()` override is added — the inherited `MCMC.seed()` already reseeds `this.r`, which is the exact object now threaded into every conditional call, so seeding the sampler and seeding the conditionals' draws become the same operation for conditionals that use the second argument.

Conditionals opt in to reproducibility by drawing all their randomness from the supplied `rng` (e.g. `rng.next()` for uniforms, or by constructing a `Distribution` once outside the conditional and reseeding it from `rng` at construction) instead of capturing an independently-seeded generator. Conditionals that ignore the second argument keep working exactly as before — JavaScript silently drops unused trailing arguments — but remain non-reproducible under `seed()`, exactly as they are today. This is a real, documented limitation: Option 1 makes reproducibility achievable, not automatic, because the base class cannot force an opaque closure to use a particular randomness source.

This is not a breaking change under CLAUDE.md's definition (constructor/public-method rename or removal, intentional parameter convention change, or changed return shape) — the conditional signature widens additively, and no existing call site's behavior changes. No deprecation cycle applies.

## Consequences

**Easier:**
- `gibbs.seed(42).sample(null, N)` is genuinely reproducible for any conditional that draws from the supplied `rng` — closing the specific gap issue #938 reports, using the same `this.r`/`seed()` machinery every other part of `MCMC` already relies on.
- `Gibbs`'s public API stays uniform with every other `MCMC` subclass: `seed()` works (does not throw) on `RWM`, `AdaptiveMetropolis`, `HMC`, and `Gibbs` alike, so generic code that seeds an arbitrary sampler instance does not need a `Gibbs`-specific exception.
- The change is a single line in `_iter()`; no new base-class hook, no new constructor parameter, no change to `MCMC` itself — consistent with ADR-0020's contract that new sampler families extend via their own `_iter`/`_adjust`/`_internal`, not via base-class changes.

**Harder:**
- The fix is opt-in, not automatic: a caller who writes the "natural" conditional style (`x => new Normal(mu(x), sigma).sample()`, capturing its own unseeded generator) still gets non-reproducible output after calling `.seed()`, with no error or warning. JSDoc and README must be explicit that reproducibility requires conditionals to consume the second `rng` argument, or the same silent-contract-violation shape resurfaces one level down.
- Conditionals that want non-uniform draws (e.g. Normal) from the threaded `rng` must either implement their own inverse-CDF/Box-Muller transform against `rng.next()`, or construct a `Distribution` once (outside the hot path) and seed it from a value derived from `rng` — there is no built-in helper for "give me a reproducible Normal draw from this raw PRNG" inside a conditional today.
