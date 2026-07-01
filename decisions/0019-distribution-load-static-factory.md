# ADR-0019: Distribution.load() as a Static Factory Method

**Date**: 2026-07-01
**Status**: Accepted

## Context

`Distribution.load(state)` reconstructs a distribution instance from a snapshot produced by `save()`. The earliest design made it an instance method, which forced callers to first invoke the constructor — allocating and initializing a fully-validated object — only to immediately discard everything the constructor produced and overwrite it with the saved state. That wasted constructor call also risked validation errors when the serialized parameter set was valid at save time but the constructor's guard had been tightened since.

## Decision

`load()` is a **static factory method**. It bypasses the constructor entirely by using `Object.create(this.prototype)`, then directly assigns the four serialized fields (`_type`, `k`, `p`, `s`, `c`, `r`) and delegates any subclass-specific post-load work to `_afterLoad()`. The method returns the fully initialized instance.

## Consequences

**Easier:**
- The returned instance is fully initialized before any method is called — no partially-constructed object is ever exposed.
- Subclasses that store non-serializable derived state (look-up tables, alias structures, etc.) have a single, well-defined hook (`_afterLoad()`) to rebuild it, rather than duplicating reconstruction logic in the constructor.
- Callers use the natural static-factory idiom: `MyDist.load(state)` instead of `new MyDist().load(state)`.

**Harder:**
- Subclasses that accumulate state beyond the four standard fields must override `_afterLoad()`; forgetting to do so is a silent bug rather than a compile-time error.
- The method cannot participate in prototype chains the way an instance method can — but no use case for that has arisen.
