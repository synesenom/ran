# ADR-0033: Generalized `runChains` sampler driver

**Date**: 2026-07-18
**Status**: Accepted

## Context

`runChains` (`src/mc/run-chains.js`) ran multiple independently-seeded chains by hardcoding `new
RWM({ logDensity, config }).seed(seed)` inside its per-seed loop. It could not drive any other
`MCMC` subclass.

ADR-0030 anticipated this: "A planned generalized `runChains(sampler, ...)` ... needs to construct
an arbitrary sampler class uniformly, without special-casing each subclass's own positional shape."
That ADR's migration (issues #962–#966) gave every `MCMC` subclass a self-describing options-object
constructor — `new RWM({ logDensity, config, initialState })`, `new HMC({ logDensity,
gradLogDensity, config, initialState })`, `new Gibbs({ conditionals, config, initialState })`, and
so on (MALA/NUTS are options-object-only per ADR-0031/ADR-0032, with no positional form to
deprecate). Because each subclass's options object already carries whatever keys it needs,
`runChains` never has to know which keys belong to which sampler — it can forward `samplerOptions`
opaquely to `new Sampler(samplerOptions)`.

The existing public call form `runChains(logDensity, config, options)` is RWM-only and
CLAUDE.md requires a deprecation cycle (warn-then-remove) rather than an outright break.

Two implementation questions were open (see thoughts/research/2026-07-18-1623-generalize-runchains.md):
how to distinguish the new call form from the legacy one when both a `Sampler` class and a
`logDensity` function are `typeof 'function'`, and whether `Gibbs` (no `logDensity`, always-accepted
proposals) is in scope.

## Decision

**New signature**: `runChains(Sampler, samplerOptions, runOptions)`. `samplerOptions` is forwarded
verbatim to `new Sampler(samplerOptions)` for every chain — `runChains` never inspects its keys.
`runOptions` keeps today's shape (`{chains, warmUpBatches, sampleSize, seeds, maxLength}`).

**Legacy-form detection**: a structural check on the first argument,

```js
function _isSamplerClass (arg) {
  return typeof arg === 'function' && arg.prototype !== undefined && typeof arg.prototype._iter === 'function'
}
```

`_iter` is the protected hook every `MCMC` subclass must override (the base class throws
`'MCMC._iter() is not implemented'` otherwise), so it is found via the prototype chain for any
concrete sampler class and absent for a plain `logDensity` function — regardless of whether that
function is an arrow function (no `.prototype` at all) or a `function` expression (has `.prototype`,
but no `_iter` on it). This mirrors the codebase's existing structural-detection idiom
(`MCMC._isOptionsForm` checks for an own `logDensity` property; `Gibbs._resolveGibbsConstructorArgs`
checks for an own `conditionals` property) rather than introducing an `instanceof` check — the
codebase's resolvers use structural checks uniformly, and `instanceof` would require importing the
private `MCMC` base class into `run-chains.js` for no practical gain (it also misclassifies passing
the abstract `MCMC` class itself, since `MCMC.prototype instanceof MCMC` is `false`; the structural
check correctly identifies it as a sampler class and lets construction fail with `MCMC`'s own clear
"is abstract and cannot be instantiated directly" error instead).

When `_isSamplerClass` is false, `runChains` treats the call as the legacy `(logDensity, config,
options)` form: it emits a one-time-per-call `console.warn` (matching the per-instantiation cadence
established in ADR-0030) and internally constructs `RWM` — the only sampler `runChains` ever
hardcoded, so no other subclass needs a legacy path.

**Gibbs is in scope.** `runChains(Gibbs, { conditionals, config }, runOptions)` works with no
special-casing, because the generic `new Sampler(samplerOptions)` forwarding does not care which
key identifies the density. `gelmanRubin`'s R-hat statistic depends only on between/within-chain
variance of the returned `number[][]` samples, not on acceptance rate or how a sample was produced
— Gibbs's always-accepted proposals do not make R-hat any less meaningful, so excluding Gibbs would
have been an artificial scope cut with no correctness or complexity justification.

## Consequences

- Callers migrate via `runChains(RWM, { logDensity, config }, runOptions)` (or any other `MCMC`
  subclass) today; the legacy `runChains(logDensity, config, options)` keeps working until removal
  (tracked for v1.32.0, alongside the constructor-level deprecations from ADR-0030/0031, per
  CLAUDE.md's versioning rules).
- `_validateChains`/`_validateSeeds` are unchanged — both operate on `runOptions`, which occupies
  the same third-argument position in both call forms once `_isSamplerClass` has resolved which
  form is in play.
- `gelmanRubin` required no changes: it only ever consumed the `samples` (`number[][][]`) `runChains`
  collected, never the sampler that produced them.
- A future sampler whose constructor legitimately wants to accept a plain, non-class function as its
  own "Sampler" role (none currently do — every `MCMC` subclass is a real ES class with `_iter` on
  its prototype) would collide with `_isSamplerClass`'s detection; judged unlikely enough for the
  `MCMC` family that no escape hatch is provided, matching ADR-0030's own equivalent risk
  acceptance for its `_isOptionsForm` check.
