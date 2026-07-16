---
date: 2026-07-16T16:00:00Z
category: "testing"
problem: "assert.strictEqual on a log-scale-stored default parameter fails by ~1e-17 even with zero adaptation"
status: complete
related_issue: "#828"
related_plan: "thoughts/plans/2026-07-16-1530-mala-sampler.md"
tags: [mcmc, mala, floating-point, log-scale, assert-closeTo, test-pattern-reuse]
---

# Solution: log-scale parameter storage breaks bit-exact state() round-trip assertions

**Date**: 2026-07-16
**Category**: testing
**Related Issue**: #828

## Problem

While writing `ran.mc.MALA`'s constructor test, `assert.strictEqual(mala.state().internal.stepSize, 0.1)` failed:

```
AssertionError: expected 0.10000000000000002 to equal 0.1
```

This happened on a **fresh** instance with no adaptation run — the assertion should have been trivially true if `stepSize` were stored and reported unchanged.

## Root Cause

`MALA` stores its step size in log-scale (`this._ls = Math.log(stepSize)`) and reports it back via `Math.exp(this._ls)` in `_internal()`. This representation was a deliberate design choice (independently recommended by both a design-propose and a design-critique agent during planning): the Robbins-Monro batch adaptation update is additive in log-space, so storing the log keeps step-size positivity a structural invariant instead of a runtime hope — the same representation `RWM` already uses for its own step scale.

The test was first written by copying HMC's analogous test, `assert.strictEqual(hmc.state().internal.stepSize, 0.1)` (`test/mc.js`, `mc.HMC` block). That pattern works for HMC only because HMC stores `_stepSize` **linearly** and reports the constructor's input bit-exact — HMC's storage representation is not MALA's, even though both classes expose a conceptually identical `stepSize` field. `Math.exp(Math.log(0.1))` does not round-trip exactly in IEEE 754 double precision (`0.10000000000000002`, an error of ~1.4e-17) — this is unconditional, not a symptom of the adaptation logic being wrong.

## Fix

Changed the assertion to a tolerance-based check reflecting the real (tiny) precision of the transform, not the naive expectation of bit-exact equality:

```js
// Log-scale storage (Math.log/Math.exp round-trip) introduces a ~1e-17 float error,
// unlike HMC's linear _stepSize storage which reports the input bit-exact.
assert.closeTo(mala.state().internal.stepSize, 0.1, 1e-15)
```

(`test/mc.js`, `mc.MALA` → `constructor` → `'should default to stepSize: 0.1 when omitted'`.)

## Prevention Strategy

Whenever a numeric parameter is stored via a transform-then-invert representation (log-scale, logit, or any `f`/`f⁻¹` pair) for a good structural reason — invariant enforcement, additive adaptation math — treat "the default/no-adaptation value is no longer bit-exact" as a direct, expected consequence, not a surprise to work around. Concretely:

- Use `assert.closeTo` with a tolerance sized to the transform's float error (~1e-15–1e-17 for a double-precision `log`/`exp` round trip), not `assert.strictEqual`.
- Before copying a `state()`/`_internal()` round-trip test pattern from a sibling class, **diff the storage representation, not just the field name**. Two classes exposing the same conceptual field (`stepSize`) can use different internal representations (linear vs. log-scale) for good reason, and a test pattern that's correct for one is silently wrong for the other.

## Related Solutions

- `solutions/correctness/2026-07-11-1230-mcmc-state-key-mismatch-silent-sigma-loss.md` — a related but distinct `state()`/`_internal()` round-trip pitfall (key-name mismatch, not float precision).

## Key Insight

Log-scale (or any invert-transform) parameter storage breaks bit-exact round-tripping even with zero adaptation applied — assert with `closeTo`, and check the sibling template's storage *representation* (not just its field name) before copying a `strictEqual` test pattern from it.
