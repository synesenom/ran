# ADR-0008: `this.c` must be a named object, never a positional array

**Date**: 2026-05-22
**Status**: Accepted

## Context

Every `Distribution` subclass pre-computes expensive constants in its constructor and stores them on `this.c` so that `_pdf`, `_cdf`, and `_q` can reuse them without recomputing on every call.

Historically these were stored as positional arrays:

```js
this.c = [Math.pow(L, alpha), Math.pow(H, alpha), 1 - Math.pow(L / H, alpha)]
// used as: this.c[0], this.c[1], this.c[2]
```

The array form was originally motivated by a belief that V8 optimises small-integer array index access more aggressively than named property access. That belief is obsolete: modern V8 uses hidden classes and inline caches for both patterns, and the difference is not measurable in micro-benchmarks against the numerical work done inside each call.

The positional array form has two active costs:

1. **Magic indices**: `this.c[2]` communicates nothing about what the constant represents. Readers must cross-reference the constructor assignment to understand any usage site.
2. **Silent breakage on reorder**: swapping two entries in the constructor silently produces wrong results everywhere they are used, with no type-checker or linter catching the error.

Issue #172 identified this as a cross-cutting convention debt and tracked its elimination across all distributions.

## Decision

`this.c` must always be assigned a **named object literal**:

```js
this.c = {
  Lalpha: Math.pow(L, alpha),
  Halpha: Math.pow(H, alpha),
  denom: 1 - Math.pow(L / H, alpha)
}
```

All usage sites reference constants by name (`this.c.Lalpha`, `this.c.denom`, etc.). Positional index access (`this.c[N]`) is never permitted.

The sole exception is `irwin-hall.js`, where `this.c` is a runtime-indexed lookup table built with `Array.from` and accessed as `this.c[k]` inside a loop. That is a genuinely array-shaped data structure, not a bag of named constants, and is exempt from this rule.

## Consequences

- **Easier**: Every usage site is self-documenting. Reordering entries in the constructor is safe — the name change is caught at every call site. New contributors can read `_pdf` or `_cdf` without needing to trace back to the constructor.
- **Harder**: Nothing. Named property access in modern V8 is not measurably slower than integer-indexed array access for the small constant objects used here.
- **Tooling**: `this.c = {}` is the default initialised in `_distribution.js` (line 35), consistent with this convention. The `state.constants` restore path (line 368) is also object-shaped and unaffected.
