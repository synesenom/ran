---
date: 2026-05-29T17:34:47Z
category: "tooling"
problem: "External code reading fitted.p by constructor argument name silently gets undefined for distributions that rename an inherited parameter in this.p"
status: complete
related_issue: "#504"
related_plan: "thoughts/plans/2026-05-29-1210-demo-page.md"
tags: [this.p, subclass, parameter-key, fit, weibull, pkey, registry]
---

# Solution: this.p Subclass Parameter Key Mismatch in Fit Display

**Date**: 2026-05-29T17:34:47Z
**Category**: tooling
**Related Issue**: #504

## Problem

When displaying MLE fit results for Weibull, reading `fitted.p.lambda` returns `undefined`. The fit result table showed `undefined` for the fitted lambda value instead of the recovered scale parameter. No error is thrown — the field simply does not exist in `fitted.p`.

## Root Cause

Weibull extends Exponential. Exponential stores its scale parameter as `this.p.lambda`. To avoid overwriting the inherited key, Weibull stores its own scale under `this.p.lambda2`. The constructor takes `(lambda, k)`, but the result lands in `this.p.lambda2`, not `this.p.lambda`.

Any external code that iterates constructor argument names (`'lambda'`, `'k'`) and directly looks up `fitted.p[argName]` will silently receive `undefined` for the scale, because `fitted.p` has no `lambda` key — only `lambda2`.

This class of mismatch affects every distribution that extends another and renames an inherited parameter to avoid a key collision.

## Fix

Added an optional `pkey` field to the DISTRIBUTIONS registry entries. When present, `pkey` overrides the `this.p` lookup key independently of the display name used in the UI label:

```js
Weibull: { args: [{name:'lambda', pkey:'lambda2', default:1}, {name:'k', default:1.5}] }
```

Fit result display reads `fitted.p[a.pkey || a.name]` — falls back to the arg name when no override is needed. The UI label still shows `lambda` (the constructor arg name); only the `this.p` lookup is redirected.

## Prevention Strategy

When writing any code that reads `fitted.p` or `dist.p` by key name derived from a constructor argument list, always check whether the distribution extends another class that may have claimed that key. The safe pattern is to provide an explicit key mapping (like `pkey`) rather than assuming constructor arg names match `this.p` keys. When auditing a new distribution: if it calls `super(...)` and the parent also has a parameter with the same name, check that the subclass constructor stores with a different key and that any registry entry documents the mapping.

## Related Solutions

- `solutions/tooling/2026-05-16-1135-docs-pages-array-build.md` — docs build page registration pattern
- `solutions/tooling/2026-05-24-1439-shared-stylesheet-cross-page-selector-leak.md` — SCSS `:has()` guard scoping

## Key Insight

When a distribution extends another and renames an inherited parameter in `this.p` to avoid collision (e.g., Weibull's `lambda2`), external code reading `fitted.p` by constructor argument name will silently get `undefined`; always map constructor names to `this.p` keys explicitly in any registry that drives fit-result display.
