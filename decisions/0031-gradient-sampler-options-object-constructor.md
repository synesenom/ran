# ADR-0031: Options-object constructor form for gradient-based MCMC samplers

**Date**: 2026-07-18
**Status**: Accepted

## Context

ADR-0030 established the options-object constructor convention for `MCMC` subclasses and migrated
`RWM`, `SliceSampler`, and `AdaptiveMetropolis`. Each of those subclasses forwards exactly
`(logDensity, config, initialState)` to `super()` unchanged, so the base class's
`MCMC._resolveConstructorArgs` — which detects and unwraps a `{logDensity, config, initialState}`
options object — covers their entire constructor arity. Migrating them was a one-line
`_supportsOptionsConstructor` flip.

ADR-0030 explicitly left open how `HMC`, `MALA`, and `NUTS` would migrate, since all three take an
extra `gradLogDensity` argument between `logDensity` and `config` that
`_resolveConstructorArgs` has no concept of — it only extracts three keys, and any other key on an
options object passed through it is silently dropped. `HMC`'s constructor also reads `config`
fields (`stepSize`, `pathLength`, `metric`) and `initialState`-derived internal state directly in
its own body (not just via `super()`), so whatever resolves the options-vs-positional form must
finish before any of that code runs.

## Decision

Add a second, parallel static resolver to the `MCMC` base class,
`MCMC._resolveGradientSamplerArgs(logDensity, gradLogDensity, config, initialState, target)`, living
alongside `_resolveConstructorArgs` (not replacing it). It uses the identical own-property detection
check (`logDensity` is a non-null object carrying an own `logDensity` key), but extracts and returns
four keys — `{logDensity, gradLogDensity, config, initialState}` — and its deprecation-warning text
correctly includes `gradLogDensity`: `` new ${target.name}({ logDensity, gradLogDensity, config, initialState }) ``.

`HMC` calls this resolver itself, before calling `super()`:

```js
constructor (logDensity, gradLogDensity, config = {}, initialState = {}) {
  const resolved = HMC._resolveGradientSamplerArgs(logDensity, gradLogDensity, config, initialState, new.target)
  logDensity = resolved.logDensity
  gradLogDensity = resolved.gradLogDensity
  config = resolved.config
  initialState = resolved.initialState
  super(logDensity, config, initialState)
  // ...unchanged body: HMC._validateGradLogDensity(gradLogDensity), etc.
}
```

By the time `super()` runs, `logDensity`/`config`/`initialState` are already fully resolved plain
values, so `MCMC`'s own `_resolveConstructorArgs` (running inside `super()`) sees the positional
form and passes them through unchanged — no double resolution, no double warning.

`HMC` does **not** override `MCMC._supportsOptionsConstructor` (it stays at the base class's default
`false`): the warning for gradient samplers is owned entirely by `_resolveGradientSamplerArgs`, gated
implicitly by whether the first argument is the options-object form, not by the boolean flag
`_resolveConstructorArgs` uses. The two resolvers are intentionally parallel, not unified — the flag
remains meaningful only for the three-key family (`RWM`/`Slice`/`AdaptiveMetropolis`).

Two alternatives were considered and rejected:

- **Per-subclass local resolver** (no base-class change): `HMC` (and later `MALA`/`NUTS`) each
  reimplement the same ~15-line detection/extraction/warning logic independently. Rejected because
  it triples the maintenance surface for identical logic across the three gradient samplers, with no
  offsetting benefit.
- **Generalized extra-keys hook** (`static _optionsExtraKeys`, iterated inside
  `_resolveConstructorArgs`, plus a transient `this._resolvedArgs` field set by the base constructor
  for the subclass to read post-`super()` and delete): rejected as over-engineered for a
  three-caller need (`HMC`/`MALA`/`NUTS` all want the identical single extra key,
  `gradLogDensity`) — it introduces a side-channel instance field with no precedent elsewhere in the
  codebase, widens `_resolveConstructorArgs`'s contract (a regression risk for the already-shipped
  `RWM`/`Slice`/`AdaptiveMetropolis` migration), and its generality (arbitrary extra-key lists) has no
  concrete second use case to justify it (YAGNI).

## Consequences

- `new HMC({ logDensity, gradLogDensity, config, initialState })` works and behaves identically to
  the positional form; the positional form keeps working with a one-time-per-instantiation
  `console.warn` naming `HMC` and the correct four-key replacement.
- `MALA`'s and `NUTS`'s own future migration issues each call the same
  `MCMC._resolveGradientSamplerArgs` with ~5 lines of constructor preamble — no detection logic to
  duplicate or design decision to re-litigate.
- `_supportsOptionsConstructor` remains meaningful only for the `RWM`/`Slice`/`AdaptiveMetropolis`
  three-key family; readers of `_mcmc.js` need a WHY comment on `_resolveGradientSamplerArgs`
  explaining why gradient samplers bypass that flag rather than reusing it.
- `Gibbs` is unaffected — its problem (a literal `null` `logDensity` slot) is a different shape and
  remains its own future migration issue, not covered by this resolver.
