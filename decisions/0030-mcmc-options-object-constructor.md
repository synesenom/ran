# ADR-0030: Options-object constructor form for MCMC samplers

**Date**: 2026-07-17
**Status**: Accepted

## Context

Every `MCMC` subclass (`RWM`, `AdaptiveMetropolis`, `SliceSampler`, `HMC`, `Gibbs`, `MALA`, `NUTS`, ...)
currently takes its own positional-argument constructor, e.g. `new RWM(logDensity, config,
initialState)`. A planned generalized `runChains(sampler, ...)` (tracked in a follow-up issue) needs
to construct an arbitrary sampler class uniformly, without special-casing each subclass's own
positional shape or the differing arity some samplers add (e.g. `HMC`'s extra `gradLogDensity`
argument). A single, sampler-agnostic `options` object is the natural uniform contract.

Introducing this is a breaking-adjacent change to the public constructor API of the `MCMC` base
class (per CLAUDE.md's ADR-required list), so it needs the standard deprecation cycle: the old
positional form keeps working with a warning before it is ever removed.

## Decision

`MCMC`'s constructor accepts two forms:

1. **Positional (deprecated)**: `new Sampler(logDensity, config, initialState)` — unchanged
   behavior, but for migrated subclasses (see below) now emits a one-time-per-instantiation
   `console.warn` naming the deprecation and the replacement call.
2. **Options object**: `new Sampler({ logDensity, config, initialState })` — a single object whose
   presence is detected by checking that the first constructor argument is a non-null object
   carrying a `logDensity` own-property (a plain object is never a valid `logDensity` value itself,
   which must be a `Function`, so the two forms cannot collide).

The detection and normalization live entirely in `MCMC._resolveConstructorArgs` (a private static
helper), invoked once at the top of the base constructor with `new.target` (so the warning names
the concrete subclass, not `MCMC`).

**The warning is gated on an explicit per-subclass opt-in**, `static get
_supportsOptionsConstructor()` (default `false` on `MCMC`; `RWM` overrides it to `true`). This
was not the original design — the first draft assumed *any* subclass forwarding
`(logDensity, config, initialState)` to `super()` unchanged got both forms "for free," with no
subclass change needed at all. Code review surfaced two concrete cases where that assumption
breaks:

- `HMC`, `MALA`, and `NUTS` take an extra `gradLogDensity` positional argument between
  `logDensity` and `config`. The options object doesn't cover it, so the auto-generated warning
  text (`new HMC({ logDensity, config, initialState })`) would tell a caller to drop a required
  argument.
- `Gibbs` always forwards a literal `null` in the `logDensity` slot (its real first argument,
  `conditionals`, is an array, not a density function) — every legitimate `Gibbs` construction
  would trip the "positional form" branch and print a warning whose suggested replacement
  (`new Gibbs({ logDensity, config, initialState })`) fails Gibbs's own `conditionals` guard.

Gating on an explicit flag means the warning (and the specific replacement snippet in its text)
only fires for subclasses confirmed to actually support that exact three-key shape. Each
subclass's own migration issue flips one line (`static get _supportsOptionsConstructor()
{ return true }`) once it has verified the options form matches its real constructor arity — this
still keeps the detection/normalization logic itself centralized and unduplicated in the base
class, just not the "does this warning apply to me" decision.

The warning fires once per instantiation (not once per process) — every positional-form call site
stays visible across a session, rather than the first constructor call silencing all the rest.
Every internal caller that constructs `RWM` (`runChains()`, `ParallelTempering`'s default sampler
factory) was updated to the options-object form in this same change, so neither public API emits
a spurious warning on every call.

## Consequences

- Callers can migrate to `new RWM({ logDensity, config, initialState })` today; the positional form
  keeps working until the deprecation cycle completes (removal gated on a future issue, per
  CLAUDE.md's versioning rules — target v1.32.0, at least one released minor after the warning
  ships).
- The upcoming generalized `runChains` can construct any `MCMC` subclass through one uniform
  `{ logDensity, config, initialState }` (plus sampler-specific extra keys) shape, without a
  per-sampler adapter.
- Future subclasses (`AdaptiveMetropolis`, `SliceSampler`, `Gibbs`, ...) need only flip
  `_supportsOptionsConstructor` to `true` (plus a JSDoc `@overload` block) once their own migration
  issue confirms the plain three-key shape fits; `HMC`/`MALA`/`NUTS` additionally need to decide
  and implement how `gradLogDensity` is carried in the options form before they can flip it.
- A sampler whose constructor legitimately wants to accept a plain object as its *first positional*
  argument (none currently do — `logDensity` is always a `Function`) would collide with this
  detection; this is judged unlikely enough for the `MCMC` family that no escape hatch is provided.
