# ADR-0050: `params()` copies array-valued parameter fields, not just the top level

**Date**: 2026-08-05
**Status**: Accepted

## Context

ADR-0047 made `Distribution.prototype.params()` and `Process.prototype.params()` return a
shallow copy (`{ ...this.p }`) instead of the live `this.p` reference, closing the hole where
`dist.params().mu = 999` corrupted the instance. ADR-0047's own Decision section already flagged
that this was incomplete: a shallow copy only protects top-level key *reassignment*. It does not
protect array- or object-valued fields from in-place mutation, because the copied top-level key
still points at the same nested array/object.

`Hyperexponential` (`src/dist/hyperexponential.js`) stores `this.p.weights` and `this.p.rates` as
arrays of numbers, read directly by `_pdf`/`_cdf`/`_generator`/`_fitInit`/`mean`/`variance`/
`skewness`/`kurtosis`. `Categorical` (`src/dist/categorical.js`) stores `this.p.weights` the same
way. Neither overrides `params()`, so both inherit the base implementation. Before this fix,
`const p = dist.params(); p.weights[0] = 0` silently changed the live distribution's behavior —
the array reference survives the `{ ...this.p }` spread untouched.

An audit of every `src/process/*.js` constructor found no process with an array-valued `this.p`
field today. `CompoundPoisson` (`src/process/compound-poisson.js`) stores `this.p.jumpDist`, but
that is a `Distribution` instance, not an array or a plain data object — ADR-0047 already
decided that nested `Distribution` instances are out of scope for this accessor: a caller
mutating `jumpDist`'s own state goes through *that* distribution's own `params()`/setters, not
through the outer process's accessor. This ADR does not revisit that carve-out.

## Decision

`params()` (both `Distribution.prototype.params()` and `Process.prototype.params()`) copies each
top-level array-valued field of `this.p` with a fresh shallow array copy (`[...array]`), on top
of the existing top-level object spread:

```js
params () {
  const p = { ...this.p }
  for (const key of Object.keys(p)) {
    if (Array.isArray(p[key])) {
      p[key] = [...p[key]]
    }
  }
  return p
}
```

This is a targeted, per-field copy keyed on `Array.isArray`, not a generic recursive deep-clone
(e.g. `structuredClone`). Two reasons:

1. **Precedent.** `support()` already established this pattern for `this.s`'s boundary objects
   (`this.s.map(b => ({ ...b }))`) rather than reaching for a generic deep-clone utility. A
   targeted per-known-shape copy is the established convention in this codebase, not a new one.
2. **Correctness over genericity.** A generic recursive/structured clone would also try to clone
   non-array objects — including `CompoundPoisson`'s `jumpDist`, a live `Distribution` instance
   carrying a PRNG and closures. `structuredClone` throws on functions, and a hand-rolled
   recursive clone would either break the same way or produce a `jumpDist` that is a
   value-alike but *not* the same object identity, which nothing in `CompoundPoisson` expects or
   needs. Keying on `Array.isArray` copies exactly the field shape that is actually a problem
   today (flat arrays of numbers) and leaves every other reference (including `jumpDist`)
   untouched, consistent with ADR-0047's explicit carve-out.

Every current array-valued field (`Hyperexponential.weights`/`.rates`, `Categorical.weights`)
holds primitive numbers, so one level of array copying is sufficient — there is no nested
array-of-arrays or array-of-objects field in the codebase today. A future distribution or process
introducing one would need this ADR revisited or superseded, not silently assumed to be covered.

## Consequences

`dist.params().weights[0] = 0` (or the `Process` equivalent) no longer has any effect on the
instance for any distribution/process whose natural parameters are arrays. Because the copy lives
entirely in the two base-class `params()` implementations, every current and future
`Hyperexponential`/`Categorical`-shaped distribution — or process, if one is ever added with an
array-valued parameter — gets the protection automatically, with no per-subclass code required.

The cost is one `Object.keys` pass and one array copy per array-valued field on every `params()`
call. `params()` is not on any hot sampling path (`sample()`/`pdf()`/`cdf()` read `this.p`
directly, never through `params()`), so this is a one-time, call-site cost, not a per-sample one.

`CompoundPoisson.params().jumpDist` remains a live reference to the same `Distribution` instance,
per ADR-0047. This ADR does not change that; a caller that needs an independent `jumpDist` snapshot
must call `.params().jumpDist.params()` (or construct a fresh instance) explicitly.
