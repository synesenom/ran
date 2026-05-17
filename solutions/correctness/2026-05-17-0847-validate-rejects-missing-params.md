---
date: 2026-05-17T08:47:06Z
category: "correctness"
problem: "Distribution.validate() silently accepted undefined/NaN parameters due to JavaScript's NaN comparison semantics"
status: complete
related_issue: "#50"
related_plan: "thoughts/plans/2026-05-17-0806-issue-50-remove-default-parameters.md"
tags: [validation, undefined, NaN, comparison-operators, fail-fast, distribution-base-class]
---

# Solution: Distribution.validate() now rejects undefined / null / NaN parameters

**Date**: 2026-05-17T08:47:06Z
**Category**: correctness
**Related Issue**: #50

## Problem

Distribution constructors with default parameter values
(`constructor (mu = 0, sigma = 1)`) allowed callers to omit required
parameters. Removing the defaults — the obvious fix for "parameters should
be required" — did not actually make `new Exponential()` throw. It
silently succeeded with `this.p.lambda = undefined`, producing a usable-
looking instance whose `sample()` emitted `NaN` with no error.

The failure surfaced only when running the test suite after removing the
defaults: 177 tests started failing in confusing ways (Math operations on
`undefined` propagating as `NaN` through every code path).

## Root Cause

`Distribution.validate()` (`src/dist/_distribution.js:49`) detects
constraint violations using standard comparison operators (`<`, `<=`, `>`,
`>=`, `!=`):

```js
case '>':
  return a <= b   // returns true if constraint 'a > b' is VIOLATED
```

In JavaScript, every comparison involving `undefined` or `NaN` returns
`false`, including the *inverted* comparisons. So `'lambda > 0'` with
`lambda = undefined`:

- `undefined > 0` → `false` (the constraint we asked for)
- `undefined <= 0` → `false` (the inverse the validator actually tests)

The validator returns `false` for the filter callback → no entry pushed to
`errors` → `errors.length === 0` → no throw. The constraint is never
recorded as violated, even though `undefined` plainly does not satisfy
`> 0`.

This was a language-level NaN-propagation trap embedded in the validation
layer. It existed before the defaults were touched. With defaults in
place, callers never passed `undefined` so the trap never tripped.

## Fix

Added a five-line guard at the top of `validate()` that runs **before**
the constraint loop:

```js
const missing = Object.entries(params)
  .filter(([, v]) => v === undefined || v === null || Number.isNaN(v))
  .map(([name]) => name)
if (missing.length > 0) {
  throw Error(`Invalid parameters. Required parameters missing or not a number: ${missing.join(', ')}.`)
}
```

The guard sits inside the existing `validate()` method, so all 131
distributions inherit it automatically — no per-constructor changes. The
`null` branch was added during review to catch explicit-null calls
(which would otherwise behave identically to undefined). See
[ADR-0004](../../decisions/0004-validate-rejects-undefined-and-nan.md)
for the rejected alternatives (per-constructor `requireParams` helper;
dropping the throws requirement).

Each distribution's `invalidParams` array in `test/dist-cases.js` gained
an empty `[]` entry, which spreads to no arguments and triggers the new
guard — the existing `UnitTests.constructor` test loop now verifies the
no-args throw for every distribution with required parameters.

Two distributions (`Degenerate`, `TukeyLambda`) had no existing
`Distribution.validate()` call at all (their constraint lists would have
been empty). Adding `Distribution.validate({ x0 }, [])` and
`Distribution.validate({ lambda }, [])` triggers the guard with no
artificial constraints.

## Prevention Strategy

**Validation layers that use comparison operators on numeric inputs must
explicitly pre-check for `undefined`/`null`/`NaN` before applying those
operators.** JavaScript's NaN comparison semantics make this silent
failure mode invisible — passing the existing test suite gives no signal
that missing inputs are unhandled. Any future numeric validator added to
this codebase should follow the same pattern:

1. Walk the params object once, filter for `undefined`/`null`/`NaN`.
2. Throw immediately if any such value is found — do not rely on
   comparison-based constraints to catch it.

When a distribution accepts a parameter that has no algebraic constraint
(e.g., `TukeyLambda.lambda` accepts any real, including 0 and negatives),
the constructor must still call `Distribution.validate({ param }, [])`
with an empty constraints array so the missing-value guard fires.

When a subclass calls `super(...)` with fewer arguments than the parent
constructor accepts (and used to rely on parent defaults — e.g.,
`Bernoulli` calling `super([1 - p, p])` and inheriting `Categorical`'s
`min = 0` default), it must pass the explicit value going forward. The
parent's defaults are not available to silently fill the gap any more.

## Related Solutions

- `solutions/distribution/2026-05-15-1730-negative-binomial-p-strict-bounds.md`
  — Earlier validation gap where boundary values (`p = 0`, `p = 1`)
  slipped through `NegativeBinomial`'s constraint list. Related theme:
  constraint-based validators have edge cases that are easy to miss.

## Key Insight

JavaScript's NaN comparison semantics (`undefined > 0 === false`) make
constraint-based validators silently pass on missing inputs — a guard
that explicitly checks for `undefined`/`null`/`NaN` before the constraint
loop is mandatory, not optional, for a numeric validation layer to fail
fast.
