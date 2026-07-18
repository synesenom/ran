---
date: 2026-07-18T11:47:08Z
category: "correctness"
problem: "Destructured-parameter guard silently unreachable for a null argument"
status: complete
related_issue: "#970"
related_plan: "thoughts/plans/2026-07-18-0705-mala-options-object-constructor.md"
tags: [destructuring, constructor-validation, options-object, mcmc, edge-case, null]
---

# Solution: MALA constructor's null guard was unreachable due to parameter-list destructuring

**Date**: 2026-07-18T11:47:08Z
**Category**: correctness
**Related Issue**: #970

## Problem

Migrating `ran.mc.MALA`'s constructor to an options-object-only form (`new MALA({ logDensity,
gradLogDensity, config, initialState })`, per #970), the first-pass implementation destructured the
options object directly in the constructor's parameter list:

```js
constructor ({ logDensity, gradLogDensity, config = {}, initialState = {} } = {}) {
  if (arguments[0] === undefined || typeof arguments[0] !== 'object' || arguments[0] === null || Array.isArray(arguments[0])) {
    throw Error('MALA: constructor requires an options object: new MALA({ logDensity, gradLogDensity, config, initialState })')
  }
  super(logDensity, config, initialState)
  // ...
}
```

`new MALA(null)` did not throw the intended clear error. Instead it threw a generic,
engine-dependent `TypeError: Cannot destructure property 'logDensity' of 'null' as it is null.` —
bypassing the guard entirely. No test in the initial implementation exercised `new MALA(null)`
(only `undefined`/no-args and the old positional-function-argument case were tested), so the gap
shipped silently until a bug-triage pass caught it during the same session.

## Root Cause

Two independent pieces of JavaScript semantics compound into a blind spot that a body-level guard
cannot close:

1. A destructured parameter's `= {}` default only activates when the argument is `undefined` —
   never for `null`. `function f ({ a } = {}) {}` called as `f(null)` still attempts to destructure
   `null` itself; the default is not consulted.
2. Parameter destructuring happens during parameter *binding*, before any statement in the
   function/constructor body executes. If it throws, the throw happens before the guard — or any
   other body code — ever runs.

Together: a validation guard placed inside the body of a constructor whose parameter list itself
destructures is provably unreachable for `null` (and for any other value where destructuring
throws, e.g. a number or boolean passed where an object is expected).

## Fix

Stop destructuring in the parameter list. Use a plain, non-destructured parameter, validate it
first with an explicit body-level check, throw the domain-specific error if invalid, and only
*then* destructure it in a separate statement:

```js
constructor (options) {
  if (options === undefined || options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw Error('MALA: constructor requires an options object: new MALA({ logDensity, gradLogDensity, config, initialState })')
  }
  const { logDensity, gradLogDensity, config = {}, initialState = {} } = options

  super(logDensity, config, initialState)
  // ...
}
```

This guarantees the guard runs before destructuring, no matter what the caller passes — `undefined`,
`null`, a function (the old positional-form misuse), an array, or any other non-plain-object value.

## Prevention Strategy

Whenever a function or constructor needs to (a) accept a single options-object argument and
(b) validate that argument with a custom error message before using it, never destructure that
argument in the parameter list itself — destructuring-in-signature and custom-guard-in-body are
mutually exclusive, because the destructuring throws before the guard can run. Use a plain
parameter, validate first, destructure second.

Always add an explicit test case that passes `null` (not just "no arguments" / `undefined`) when
writing this validate-then-destructure pattern — `null` is specifically the case that slips past a
destructured default parameter's own implicit guard, and is easy to omit if the test suite only
covers the "caller forgot the argument entirely" case.

This applies to any future `MCMC` subclass adopting an options-object-only constructor (`NUTS`, or
any other sampler with no prior release), and to any other place in `ranjs` adopting the
options-object convention established by ADR-0030/ADR-0032. `HMC`'s own migration (#966) took a
different path — it has a released positional form to preserve, so it resolves both forms via a
shared base-class helper (`MCMC._resolveGradientSamplerArgs`, ADR-0031) rather than rejecting the
positional form outright — so this specific destructuring pitfall does not apply to it the same
way.

## Related Solutions

No directly related prior solution found (searched `solutions/` for destructuring/options-object
validation patterns).

## Key Insight

A destructured default parameter (`{ a } = {}`) only guards against `undefined`, never `null`, and
the destructuring itself throws before any guard written in the function body can run — so
options-object validation must always happen on a plain (non-destructured) parameter first, with
destructuring as a separate statement afterward.
