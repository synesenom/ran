---
date: 2026-05-23T18:10:00Z
category: "performance"
problem: "super._q() calls across 10+ derived distributions go megamorphic in V8, causing 56× quantile slowdown"
status: complete
related_issue: "#366"
related_plan: "thoughts/plans/2026-05-23-1801-super-q-megamorphic.md"
tags: [v8, megamorphic, inline-cache, jit, super, quantile, derived-distribution, performance]
---

# Solution: V8 Megamorphic Deoptimization from `super._q()` in Derived Distributions

**Date**: 2026-05-23T18:10:00Z
**Category**: performance
**Related Issue**: #366

## Problem

Quantile computation for 10 derived distributions (BirnbaumSaunders, DoubleWeibull, ExponentiatedWeibull, JohnsonSB, JohnsonSU, LogCauchy, LogLaplace, LogNormal, LogitNormal, TruncatedNormal) was 56× slower than the parent-class operation despite each being a trivial closed-form transform. Benchmark: LogNormal quantile throughput was 56× lower than Normal's, with no numerical difference in output.

## Root Cause

V8's inline cache (IC) at a `super._q()` call site is keyed on the hidden class (shape) of the receiver. When 10+ concrete subclasses all invoke `super._q()` at the same bytecode offset, the IC exceeds V8's polymorphic threshold and goes **megamorphic** — it falls back to a generic, un-JIT-compiled dispatch path.

This is intrinsic to JavaScript prototype-chain dispatch: each subclass is a distinct V8 hidden class, so the IC sees a different shape on every call from a different subclass. V8 can optimise a call site for up to ~4 shapes (polymorphic); beyond that it gives up and uses the slow generic path for all of them. Since all parent `_q` methods are closed-form, the 56× slowdown was entirely dispatch overhead.

## Fix

Each `super._q(arg)` call was replaced with the parent's closed-form quantile formula inlined directly into the child's `_q` method.

All parent formulas reference only `this.p.*` (parameters) and `this.c.*` (pre-computed constants), both set by the parent constructor and accessible on `this` without any superclass lookup:

| Parent | Inlined formula |
|--------|-----------------|
| `Normal._q(p)` | `this.p.mu + this.c.sigmaRoot2 * erfinv(2 * p - 1)` |
| `Weibull._q(p)` | `this.p.lambda2 * Math.pow(-Math.log(1 - p), 1 / this.p.k)` |
| `Cauchy._q(p)` | `this.p.x0 + this.p.gamma * Math.tan(Math.PI * (p - 0.5))` |
| `Laplace._q(p)` | `p < 0.5 ? mu + b*log(2p) : mu - b*log(2-2p)` |

The six Normal-derived distributions added `import { erfinv } from '../special'` (the function was already exported; only the import was missing). No mathematical changes, no API changes — purely algebraic substitution.

As an incidental cleanup, `TruncatedNormal`'s positional constant array `this.c2 = [phiA, Z, phiMid]` was migrated to named fields on `this.c` via `Object.assign(this.c, { phiA, Z })`, matching the project's named-object convention and dropping the unused third element.

**Result**: LogNormal quantile throughput restored to within 1× of Normal (benchmark: Normal=154ms, LogNormal=153ms per 100k calls).

## Prevention Strategy

Any `super.method()` call shared across 6+ concrete subclasses will go megamorphic in V8. The threshold is ~4 receiver shapes before V8 abandons polymorphic specialisation.

**Rule for this codebase**: Derived distributions must never delegate `_pdf`, `_cdf`, or `_q` to `super.*` in performance-critical paths. When a derived distribution is a monotone transform of a parent (e.g. LogNormal → Normal), inline the parent's formula using `this.p.*` and `this.c.*` directly. The parent's parameters and constants are always on `this` after the parent constructor runs — no superclass traversal is needed at call time.

**Checklist when adding a new derived distribution**:
- [ ] Does `_q` call `super._q`? → inline the parent formula
- [ ] Does `_pdf` call `super._pdf` in the sample hot path? → inline or restructure
- [ ] Does `_cdf` call `super._cdf` in the sample hot path? → inline or restructure

## Related Solutions

No prior performance solutions found in this repository.

## Key Insight

In a distribution hierarchy where 6+ subclasses each call `super._q()`, V8 goes megamorphic at that call site and disables JIT for all of them — inline the parent's closed-form formula using `this.p.*` and `this.c.*` instead, which keeps each subclass's `_q` call site monomorphic and restores full JIT throughput.
