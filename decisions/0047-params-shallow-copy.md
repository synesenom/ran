# ADR-0047: `params()` returns a shallow copy, not a live reference

**Date**: 2026-08-01
**Status**: Accepted

## Context

`Distribution.prototype.params()` (`src/dist/_distribution.js`) has always returned `this.p`
directly:

```js
params () {
  return this.p
}
```

This lets a caller mutate a distribution's internal state through the returned object, e.g.
`const p = dist.params(); p.mu = 999` silently corrupts the instance for every subsequent
`pdf()`/`cdf()`/`sample()` call, with no error and no indication anything went wrong.

`Process.prototype.params()` (`src/process/_process.js`, added in #1251) copied this exact
pattern for consistency with the already-shipped `Distribution.params()` — even though #1251's
own issue text described the intended semantics as "returns a shallow copy of `this.p`". The
mismatch between #1251's stated intent and its shipped implementation was flagged during bug
triage and tracked as #1257 for a human decision.

## Decision

Both `Distribution.params()` and `Process.params()` return a shallow copy of `this.p`
(`{ ...this.p }`), not the live object. This is treated as a correctness fix rather than a
breaking change requiring a deprecation cycle: the previous live-reference behavior let a public
accessor silently corrupt internal state, which is itself the bug being fixed, not an intentional
contract being broken. Nothing in the codebase relied on the old mutable-reference behavior
(`compound-poisson.js` and `guess.js` both only read from the returned object).

A shallow copy closes the reassignment hole for the common case — `this.p` mostly holds
primitive parameter values, or, in `CompoundPoisson`'s case, a `Distribution` instance passed
through by reference (`jumpDist`). Deep-cloning nested `Distribution` instances is out of scope:
a caller mutating a nested distribution's own state goes through that distribution's own
`params()`/setters, not through the outer process's accessor.

The shallow copy does **not**, however, protect array- or object-valued parameter fields from
in-place mutation through the returned object: `dist.params().weights[0] = 0` still reaches
`this.p.weights` because `{ ...this.p }` only copies the top-level reference, not the array
contents. `Hyperexponential` (`this.p.weights`, `this.p.rates`) and `Categorical`
(`this.p.weights`) both store their parameters this way and are read directly by `_pdf`/`_cdf`/
`_generator`/`_fitInit`, so this gap is real, not hypothetical. It predates this fix — the old
`return this.p` had the identical hole — so it is not a regression introduced here, but the
guarantee below is scoped accordingly rather than claimed as complete. Closing it (e.g. a deeper
copy for array-valued parameter fields) is tracked as a separate follow-up issue, #1299.

## Consequences

Both accessors are now safe to hand to arbitrary calling code against top-level key
reassignment, without risking internal state corruption from that vector. `dist.params().mu = 999`
(or the `Process` equivalent) no longer has any effect on the instance — array/object-valued
parameter fields remain exposed per the caveat above. Every future `Distribution` or `Process`
subclass's `params()` inherits this behavior automatically since neither overrides the base
implementation. Code that depended on the old live-reference aliasing (none currently exists)
would need to call `.params()` fresh after each intended mutation instead — but since
mutation-through-`params()` was never a documented or intended usage, no migration guidance is
needed.

Bug triage on this same fix surfaced the identical pattern in `Distribution.prototype.support()`,
which also returned `this.s` by live reference into the array `_belowSupport`/`_aboveSupport`/
`_atClosedBoundary` read from directly. It is fixed the same way and covered by this ADR's
rationale, with one addition: `this.s` is an array of `{closed, value}` boundary objects, so a
plain array spread is not enough on its own — `support()` copies both the array and each boundary
object (`this.s.map(b => ({ ...b }))`) to prevent `dist.support()[0].value = x` from reaching
through to the original.
