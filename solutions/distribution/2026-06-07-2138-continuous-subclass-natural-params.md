---
date: 2026-06-07T21:38:00Z
category: "distribution"
problem: "9 continuous subclasses returned parent's reparametrized parameter keys from params()"
status: complete
related_issue: "#742"
related_plan: "N/A"
tags: [this.p, natural-params, subclass, reparametrization, inheritance, this.c, Object.assign]
---

# Solution: Continuous Subclass Natural Parameters

**Date**: 2026-06-07T21:38:00Z
**Category**: distribution
**Related Issue**: #742

## Problem

9 continuous distribution subclasses that reparametrize their parent constructor call never overrode `this.p` after `super()`. As a result, `params()` returned the parent class's internal parameter names rather than the subclass's declared natural parameters. For example:
- `new Chi2(6).params()` returned `{ alpha: 3, beta: 0.5 }` (Gamma's keys) instead of `{ k: 6 }`
- `new Erlang(3, 2).params()` returned `{ alpha: 3, beta: 2 }` instead of `{ k: 3, lambda: 2 }`
- `new Rayleigh(1).params()` returned `{ lambda: 1.41, k: 2 }` (Weibull's keys) instead of `{ sigma: 1 }`

This violated the documented contract of `params()` ("returns natural/user-facing params only", ADR-0009/0014) and broke `.fit()` display for all 9 distributions.

Affected distributions: Chi2, Erlang, Maxwell-Boltzmann, Rayleigh, DoubleWeibull, HalfNormal, Slash, LogCauchy, StudentZ.

## Root Cause

The parent class constructor populates `this.p` with its own parameter names. When a continuous subclass calls `super(reparametrized_args)`, the parent sets `this.p = { parent_params }`. The subclass never replaces it, so the wrong keys persist.

A secondary issue: when `this.p` was subsequently corrected in a subclass, any methods that delegated to `super._xxx()` and read `this.p.parentKey` would find `undefined` — silently producing `NaN` in computed values. This affected `_q`, `_generator`, and moment methods in several classes.

A third issue: multi-level inheritance chains (e.g., Chi extends Chi2) used plain `this.c = { newKey }` assignment, which silently destroyed all constants the parent had stored in `this.c`. The `Object.assign` pattern is mandatory for subclasses.

## Fix

For each affected subclass, after `super()`:
1. **Override `this.p`** with only the subclass's natural (user-facing) parameters.
2. **Move parent-derived values** that methods still need into `this.c` via `Object.assign(this.c, { derived })`.
3. **Rewrite all methods** that formerly delegated to `super._xxx()` using `this.c` values directly, eliminating the dependency on `this.p.parentKey`.

For multi-level inheritance (Chi extends Chi2), always use `Object.assign(this.c, {...})` — never plain `this.c = {...}` — to avoid silently clobbering parent constants.

**Pattern**:
```js
constructor (sigma) {
  super(sigma * Math.SQRT2, 2)     // Weibull(lambda2, k) sets this.p = {lambda: sigma*√2, k: 2}
  this.p = { sigma }               // override with natural params
  Object.assign(this.c, { lambda2: sigma * Math.SQRT2 })  // preserve derived value in this.c
}
```

## Prevention Strategy

After implementing any continuous subclass that calls `super()` with reparametrized arguments, verify:

```js
const d = new MyDist(arg1, arg2)
console.assert(Object.keys(d.params()).join(',') === 'arg1,arg2')
```

The keys of `params()` must exactly match the constructor's declared parameter names. If they don't, apply the `this.p = { natural }` + `Object.assign(this.c, { derived })` pattern.

In multi-level inheritance chains, always use `Object.assign(this.c, {...})` to add constants — never `this.c = {...}`, which destroys the parent's constants.

## Related Solutions

- `solutions/tooling/2026-05-29-1734-this-p-subclass-pkey-fit-display.md` — original discovery of the `params()` key leak in the Categorical family
- `solutions/correctness/2026-05-23-1930-gamma-subclass-q-inheritance-guard.md` — related issue with `_q` delegation in Gamma subclasses

## Key Insight

When a continuous subclass reparametrizes its parent constructor call, it must explicitly override `this.p` with its own natural parameters after `super()`, move any derived values the subclass methods need into `this.c` via `Object.assign`, and rewrite delegating methods to read `this.c` rather than `this.p`.
