# ADR-0051: `params()` clones Distribution-instance-valued fields, not just arrays

**Date**: 2026-08-06
**Status**: Accepted

## Context

ADR-0047 (`params()`/`support()` return copies, not live references) explicitly carved out
`CompoundPoisson`'s `jumpDist` field — a `ran.dist.Distribution` instance nested inside
`this.p` — from its copy guarantee:

> Deep-cloning nested Distribution instances is out of scope: a caller mutating a nested
> distribution's own state goes through that distribution's own params()/setters, not through
> the outer process's accessor.

ADR-0050 (array-valued field deep-copy, #1299) repeated this carve-out verbatim when it closed
the equivalent gap for array-valued fields, reasoning that a generic recursive/structured clone
would incorrectly try to clone `jumpDist` and that ADR-0047 had already decided that was out of
scope.

Both ADRs' shared premise — that mutating `jumpDist`'s own state doesn't reach the live process
— is false. `CompoundPoisson._next()` (`src/process/compound-poisson.js`) samples directly from
`this.p.jumpDist` on every step, with no per-step reseed:

```js
_next () {
  const k = poisson(this.r, this.p.lambda * this.p.dt)
  let sum = 0
  for (let i = 0; i < k; i++) {
    sum += this.p.jumpDist.sample()
  }
  return this.x + sum
}
```

The only place `jumpDist` gets reseeded is `CompoundPoisson.prototype.seed()`, once, at seed
time — not on every step. This means `jumpDist`'s PRNG stream *is* the live process's own
internal state for jump magnitudes, not an isolated implementation detail behind its own
accessor. Confirmed empirically: seeding the same outer process identically but calling
`.seed()` on `params().jumpDist` in between produces a different `path()` than not doing so,
even though nothing touched the outer process's own PRNG (`this.r`) or called its own `.seed()`
again:

```js
const cpp1 = new CompoundPoisson(new Gamma(2, 1), 3, 1).seed(42)
const path1 = cpp1.path(20)

const cpp2 = new CompoundPoisson(new Gamma(2, 1), 3, 1).seed(42)
cpp2.params().jumpDist.seed(999)  // caller reseeds what they believe is an inert snapshot
const path2 = cpp2.path(20)

path1 !== path2  // the live process's future output silently changed
```

`Distribution` instances also expose `.sample()`, another mutating instance method (it consumes
from `this.r`). Calling it on `params().jumpDist` — e.g. to "peek" at a likely jump size — has
the identical effect: it advances the same PRNG stream `_next()` will consume from next.

This is exactly the aliasing class of bug #1299/ADR-0050 fixed for array fields, just for a
field shape (a stateful object with public mutator methods) that neither #1299's scope nor
ADR-0047's original carve-out anticipated correctly.

## Decision

`Distribution` gains a public `copy()` method — `copy() { return this.constructor.load(this.save()) }`
— and `params()` (both `Distribution.prototype.params()` and `Process.prototype.params()`) now
clones any field whose value is a `Distribution` instance via it:

```js
const p = { ...this.p }
for (const key of Object.keys(p)) {
  if (Array.isArray(p[key])) {
    p[key] = [...p[key]]
  } else if (p[key] instanceof Distribution) {
    p[key] = p[key].copy()
  }
}
return p
```

`copy()` is a thin named wrapper around the existing `save()`/`load()` round-trip, not a new
cloning mechanism — `save()`/`load()` was already the one mechanism guaranteed to work for *any*
`Distribution` subclass regardless of constructor argument shape (reconstructing from `params()`'s
own output would be wrong in general: `Hyperexponential`'s constructor takes a single array of
`{weight, rate}` objects, a shape that does not match its own `params()` output
`{weights, rates, n}`). Naming it `copy()` rather than inlining `x.constructor.load(x.save())` at
each of the two call sites (`Distribution.prototype.params()` and `Process.prototype.params()`)
both removes the duplication between them and gives the round-trip a self-documenting name at the
call site, instead of requiring a reader to know the `save()`/`load()` trick to see that the branch
clones rather than aliases. It is public, not `_`-prefixed, because "give me an independent copy of
this distribution instance, including its own PRNG state" is a genuinely useful primitive on its
own — e.g. running two MCMC chains seeded from the same fitted distribution without them sharing
PRNG state — not just an internal `params()` implementation detail.

This is on `Distribution.prototype.params()` as well as `Process.prototype.params()`, even
though no shipped distribution currently nests another `Distribution` instance in its own `this.p`
— matching the existing precedent that both base classes carry the identical array-copy logic
(ADR-0050) for symmetry, so a future distribution author doesn't have to discover that only one
of the two base classes protects this field shape.

This supersedes ADR-0047's carve-out for nested `Distribution` instances specifically (its
shallow-copy decision for plain primitive/array fields stands unchanged) and corrects ADR-0050's
repetition of that carve-out.

## Consequences

`cpp.params().jumpDist.seed(...)` (or `.sample()`, or any other mutating call) no longer has any
effect on the live `CompoundPoisson` process's own sample stream — `params()` now provides the
full independence guarantee ADR-0047 originally intended, for every field shape currently in the
codebase (primitives, arrays, and nested `Distribution` instances).

The cost is one `save()`/`load()` round-trip (via `copy()`) per `Distribution`-instance-valued
field, per `params()` call — more expensive than the array-copy branch (a full state
serialize/deserialize, including the field's own PRNG state, vs. a single array spread), but
`params()` remains off every hot sampling path (confirmed during #1299's review:
`sample()`/`pdf()`/`cdf()`/`_next()` read `this.p` directly, never through `params()`), so this is
a one-time, call-site cost.

`jumpDist.save()`'s `prngState` reflects the live `jumpDist`'s PRNG state *at the moment
`params()` is called* — the clone's own future `.sample()` calls diverge from the live process's
the instant either one advances, exactly as expected of a true snapshot. This is different from,
and strictly safer than, the previous behavior, where the two were never actually independent to
begin with.

`Distribution.prototype.copy()` is new public API surface, available to every distribution
without per-subclass work (it is implemented once on the base class, like `save()`/`load()`/
`seed()`), so it carries no completeness-checklist burden for existing or future distributions.
