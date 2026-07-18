# ADR-0031: MALA ships an options-object-only constructor via parameter destructuring

**Date**: 2026-07-18
**Status**: Accepted

## Context

ADR-0030 introduced the options-object constructor form for `MCMC` subclasses, detected centrally
by `MCMC._resolveConstructorArgs` for a plain three-key shape: `{ logDensity, config,
initialState }`. `RWM`, `AdaptiveMetropolis`, and `Slice` migrated by simply forwarding
`(logDensity, config, initialState)` to `super()` unchanged and flipping `static get
_supportsOptionsConstructor() { return true }` — none of them has an extra constructor argument,
so the shared three-key detection already matches their real arity.

ADR-0030's own "Consequences" section left one question open: *"`HMC`/`MALA`/`NUTS` additionally
need to decide and implement how `gradLogDensity` is carried in the options form before they can
flip [`_supportsOptionsConstructor`]."* No subclass had answered this anywhere in the codebase —
`HMC`'s own migration (issue #966) is still open, and `MALA` (issue #970) is the first to need an
answer, but under a materially different constraint than `HMC`/`NUTS` will face: `MALA` has no
released positional constructor to stay backward-compatible with (issue #970 explicitly requires
**no** positional fallback and **no** deprecation warning), whereas `HMC`/`NUTS` do have a released
positional form and must support both during a deprecation cycle.

Three approaches were evaluated (via a design-propose/design-critique agent pair):

1. **Destructure-and-forward**: `constructor ({ logDensity, gradLogDensity, config = {},
   initialState = {} })` — destructure the single options object directly in the parameter list,
   then call `super(logDensity, config, initialState)` unchanged. The base class receives a
   `Function` as its first argument and takes its normal positional code path
   (`_resolveConstructorArgs`'s `isOptionsForm` check is `typeof logDensity === 'object'`, which is
   `false` for a `Function`) — `_mcmc.js` needs no changes, and `_supportsOptionsConstructor` stays
   at its inherited default (`false`), since MALA never presents an options object to the base
   class at all.
2. **Validate-then-pass-through**: `constructor (options)`, with a MALA-specific
   `_validateOptions` guard, then `super(options)` — relying on the base class's existing
   detection to extract the three keys it knows about, while MALA reads `gradLogDensity` from the
   same object after `super()` returns.
3. **Generalize the base class**: teach `MCMC._resolveConstructorArgs` itself to extract a
   `gradLogDensity` key and stash it for subclass access.

## Decision

Adopt **Option 1 (destructure-and-forward)**.

`MALA`'s constructor becomes:

```js
constructor (options) {
  if (options === undefined || options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw Error('MALA: constructor requires an options object: new MALA({ logDensity, gradLogDensity, config, initialState })')
  }
  const { logDensity, gradLogDensity, config = {}, initialState = {} } = options

  super(logDensity, config, initialState)
  // ... unchanged body ...
}
```

A guard at the top of the constructor throws a MALA-specific error for the common misuse cases —
calling the old positional shape (e.g. `new MALA(logDensity, gradLogDensity, config)`), passing
`null`, or calling with no arguments at all — rather than letting a destructuring assignment fail
with a generic, engine-dependent `TypeError`. The destructuring is deliberately kept out of the
parameter list itself (`constructor (options)`, not `constructor ({ logDensity, ... })`): a
destructured parameter's `= {}` default only ever applies when the argument is `undefined` — a
first pass at this guard destructured directly in the parameter list and checked `arguments[0]`
inside the body, which left `new MALA(null)` unguarded, since destructuring `null` throws before
the guard's own body ever runs. Validating the plain `options` parameter first, then destructuring
it in a separate statement, closes that gap.

`_supportsOptionsConstructor` is **not** overridden — it stays at `MCMC`'s inherited default
(`false`). That flag exists solely to gate the *positional-form deprecation warning* inside
`_resolveConstructorArgs`; since MALA's own constructor never forwards an options object to
`super()` (it always forwards the already-unpacked `logDensity` function), the base class's
positional/options branching is irrelevant to MALA and the flag has no meaningful value to report.

Option 3 is rejected outright: it would modify shared code (`_mcmc.js`) used by every `MCMC`
subclass, contradicting issue #970's explicit scope ("must not touch other MCMC subclasses") and
ADR-0030's own deferral of this exact question to each subclass's migration issue individually.

Option 2 is rejected in favor of Option 1: it produces a materially larger diff (a
`_validateOptions` static method, plus re-extracting `config` from `options` after `super()`
returns since `config` is no longer a named parameter) for no behavioral gain over Option 1's
single-line guard, and — as surfaced by design-critique — a naive application of Option 2 could
incorrectly flip `_supportsOptionsConstructor` to `true`, which ADR-0030 explicitly says is wrong
for `MALA` (the base class's auto-generated warning text omits `gradLogDensity`, which would be a
broken suggested replacement, if the warning path were ever accidentally reached).

## Consequences

- `new MALA({ logDensity, gradLogDensity, config, initialState })` is the only supported
  constructor form; there is no positional fallback and no deprecation warning, matching MALA's
  status as a distribution with no prior release to stay compatible with.
- No changes to `src/mc/_mcmc.js` or any other `MCMC` subclass. The change is entirely local to
  `src/mc/mala.js`, its JSDoc, and its tests.
- This is a **one-off pattern**, not a new shared convention: `HMC`'s and `NUTS`'s own migration
  issues (#966 and a future NUTS issue) still need to independently decide how they carry
  `gradLogDensity` in the options form, because unlike MALA they must support the *positional* form
  too during a deprecation cycle (they have released positional constructors today) — a
  destructured-parameter constructor cannot accept both a bare function and an options object as
  its single argument, so this exact approach does not transfer to them unchanged. Each of those
  issues should re-evaluate this tradeoff against their own backward-compatibility constraint
  rather than assuming this ADR settles the question for them.
- `MALA`'s JSDoc collapses to a single constructor form (no `@overload` pair), unlike
  `RWM`/`AdaptiveMetropolis`/`Slice`, since there is only one supported shape.
