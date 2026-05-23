# ADR-0009: Rename Single-Letter Instance Fields on Distribution Base Class

**Date**: 2026-05-23
**Status**: Accepted

## Context

The `Distribution` base class defines six single-letter instance fields (`this.t`, `this.k`, `this.p`, `this.s`, `this.r`, `this.c`) that are referenced across 131+ distribution implementation files. Single-letter names provide no semantic signal to readers, making the codebase harder to navigate and maintain.

The serialized state format (`save()`/`load()`) already uses descriptive names (`params`, `constants`, `support`, `prngState`), creating an inconsistency between in-memory field names and serialized names.

Two field renames are constrained by existing public method collisions: `type()` exists (cannot rename `this.t` to `type`) and `support()` exists (cannot rename `this.s` to `support`).

## Decision

Rename all six fields to descriptive names, deployed as six sequential PRs (one field per PR) to stay within the 400-line production-code diff cap and keep each PR independently revertable:

| Old name | New name | Notes |
|----------|----------|-------|
| `this.t` | `this._type` | Underscore avoids collision with `type()` method |
| `this.k` | `this.paramCount` | No collision |
| `this.r` | `this.prng` | No collision |
| `this.s` | `this._support` | Underscore avoids collision with `support()` method |
| `this.c` | `this.constants` | No collision; aligns with serialized state key |
| `this.p` | `this.params` | No collision; aligns with serialized state key |

The serialized state keys (`params`, `constants`, `support`, `prngState`) remain unchanged for backward compatibility.

## Consequences

- Code becomes self-documenting: `this.params.mu` is unambiguous; `this.p.mu` was not.
- The mechanical rename touches ~131 files per PR (for the large fields), but each change is a simple find-replace with no algorithmic risk.
- Underscored fields (`_type`, `_support`) signal intent that direct external access should go through the public methods `type()` and `support()`.
- ADR-0008 (named-object convention for `this.c`) remains valid — it governs the shape of the value, not the field name.
