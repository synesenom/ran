# ADR-0004: `Distribution.validate()` rejects `undefined` and `NaN`

**Date**: 2026-05-17
**Status**: Accepted

## Context

Issue #50 removes default parameter values from every distribution constructor
so that parameters are required inputs. The acceptance criterion is that
`new SomeDistribution()` must throw for any distribution with at least one
required parameter.

However, `Distribution.validate()` (`src/dist/_distribution.js:49-82`) does
not currently catch missing parameters. Its constraint checks use the
standard comparison operators (`<`, `<=`, `>`, `>=`, `!=`), and in JavaScript
every comparison against `undefined` (or `NaN`) returns `false` — including
the inverse comparisons used to detect violations. As a result, a constraint
like `'lambda > 0'` with `lambda = undefined` is never recorded as violated,
the `errors` array stays empty, and the constructor silently produces a
broken instance whose `sample()` returns `NaN`.

This is the worst possible failure mode for a statistical library: invalid
input produces a usable-looking generator that quietly emits garbage. After
removing the defaults, this failure mode would surface for any user who
forgets a parameter — exactly the scenario the issue is trying to make safe.

Three resolutions were considered:

- **(A) Guard inside `validate()`** — add a five-line check at the top of
  the existing method that throws if any param value is `undefined` or
  `NaN`. Single point of enforcement.
- **(B) New `Distribution.requireParams()` helper called by every
  constructor** — adds a method to the base class API and ~131 new
  one-line calls.
- **(C) Drop the "throws" requirement** — silently accept broken instances.

The issue's "out of scope" line lists the `validate()` method, but the
critique observed that the change in (A) is purely additive: it catches a
case the existing logic was meant to catch but happens to miss because of
JavaScript's NaN comparison semantics. CLAUDE.md's "prerequisite extraction"
decomposition pattern anticipates exactly this kind of small fix discovered
during implementation.

## Decision

Extend `Distribution.validate()` with a guard at the top of the method that
throws `Error('Invalid parameters...')` if any value in the `params` object
is `undefined`, `null`, or `NaN`, before running the existing constraint loop.

```js
static validate (params, constraints) {
  const missing = Object.entries(params)
    .filter(([, v]) => v === undefined || v === null || Number.isNaN(v))
    .map(([name]) => name)
  if (missing.length > 0) {
    throw Error(`Invalid parameters. Required parameters missing or not a number: ${missing.join(', ')}.`)
  }
  // ... existing constraint loop unchanged
}
```

The error message format mirrors the existing throw at the bottom of the
method so consumers see a consistent prefix (`Invalid parameters.`).

Each distribution's `invalidParams` array in `test/dist-cases.js` gains an
empty `[]` entry, which causes the existing constructor unit test
(`test/dist.js:16-20`) to verify the throws behavior for every distribution
with at least one required parameter. The seven parameterless distributions
(Kolmogorov, HyperbolicSecant, etc.) do not appear in `dist-cases.js` with
required-parameter test cases, so no `[]` is added there.

## Consequences

**Easier**:
- Every distribution constructor now fails fast on missing parameters,
  matching the library's broader "fail fast on invalid input" philosophy.
- A single five-line addition replaces what would otherwise be ~131
  per-constructor checks.
- Future distributions automatically inherit this behavior — no contributor
  needs to remember a separate `requireParams` call.

**Harder**:
- `Distribution.validate()` now has two failure modes (missing/NaN vs.
  constraint violation) instead of one. The error messages distinguish
  them but the calling code sees a single `Error` type.
- Any future caller that wanted to use `validate()` to *report* on undefined
  values (rather than throw) can no longer do so.

**Risk**:
- Low. No existing test asserts on the validate error message text (verified
  via grep). All existing throwing behavior is preserved unchanged; only a
  previously silent case now throws.
