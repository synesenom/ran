---
date: 2026-05-24T06:30:43Z
category: "performance"
problem: "Using erfinv as a Newton-refinement seed produces worse throughput than the Brent fallback it was meant to replace"
status: complete
related_issue: "#368"
related_plan: "thoughts/plans/2026-05-24-0604-student-t-quantile.md"
tags: [quantile, erfinv, newton, seed, student-t, cornish-fisher, rational-approximation, a-s-26-2-17, performance, virtual-dispatch]
---

# Solution: erfinv as Newton Seed Negates the Speedup

**Date**: 2026-05-24T06:30:43Z
**Category**: performance
**Related Issue**: #368

## Problem

`StudentT.q(p)` had no dedicated `_q` method, so every quantile call fell through to
`_qEstimateRoot` — a randomised bracket search followed by Brent root-finding requiring
~20 evaluations of `regularizedBetaIncomplete` (~336K ops/sec).

The plan called for a Cornish-Fisher seed + Newton refinement as the replacement (~3–5 CDF
evaluations). When implemented with `erfinv(2p-1)` as the normal-quantile seed, throughput
dropped to **~85K ops/sec — slower than Brent**. The new implementation was 4× worse than
what it replaced.

## Root Cause

Two compounding issues:

1. **Obvious**: No `_q` implemented → Brent fallback with expensive bracket search + ~20 CDF calls.

2. **Non-obvious**: `erfinv` internally runs its own Newton iteration loop (see
   `src/special/error.js:98–102`). A single `erfinv` call costs **~9.5µs**, roughly equal to
   the entire 5-step Newton refinement loop that follows it. The seed computation consumed as
   much time as the actual inversion:

   ```
   erfinv(2p-1)  →  ~9.5µs   (seed — dominates!)
   5 × Newton    →  ~2.3µs   (refinement)
   Total         →  ~11.8µs  →  ~85K ops/sec
   ```

   Since `erfinv` was used only to seed a subsequent Newton loop, the approximation accuracy
   it provided (machine precision) was overkill — any seed within 1–2 digits would suffice for
   Newton's quadratic convergence to take over in 2–3 extra steps.

## Fix

Replaced `erfinv(2p-1)` with the A&S §26.2.17 rational approximation for the normal quantile.
This is a closed-form expression using only `log + sqrt + polynomial` arithmetic:

```js
const s = Math.sqrt(-2 * Math.log(1 - p))
const z = s - (2.515517 + s * (0.802853 + s * 0.010328)) /
  (1 + s * (1.432788 + s * (0.189269 + s * 0.001308)))
```

Accuracy: |error| < 4.5×10⁻⁴ in z — more than sufficient for Newton's quadratic convergence
to reach machine precision in 2–3 additional steps. Cost: ~100ns (vs erfinv's ~9.5µs, a
~95× reduction).

Revised cost breakdown:
```
A&S §26.2.17 seed  →  ~100ns
CF 2-term correction → ~50ns
5 × Newton         →  ~1.8µs
Total              →  ~2µs   →  ~488K ops/sec  (within 3× of jStat's ~787K)
```

The `erfinv` import was removed from `student-t.js` entirely.

A secondary correction: the plan called for a `StudentZ._q` override returning
`super._q(p) / this.c.sqrtNu`. This would have been **incorrect** — `super._q(p)` on a
`StudentZ` instance dispatches `StudentT._q` with `this._cdf` and `this._pdf` resolving
to StudentZ's overridden scale-transform versions. Newton already solves for the StudentZ
quantile; dividing by `sqrtNu` again would double-apply the scale. No override was added.

## Prevention Strategy

**Rule**: When using a function only as a seed for a subsequent Newton/Halley refinement
loop, benchmark the seed function independently first. If the seed function itself iterates
(like `erfinv`, `gammaLowerIncompleteInv`, `brent`), its cost will dominate the total and
negate the speedup of the refinement.

**Preferred seed functions for normal-quantile seeds in quantile implementations**:
- A&S §26.2.17 rational approximation (accuracy ~4.5×10⁻⁴, cost ~100ns) — always prefer
  this over `erfinv` when the result is only used as a seed
- Cornish-Fisher expansion from this approximation gives a ~3-digit t-quantile seed,
  sufficient for Newton to reach machine precision in 3–5 steps

**Rule for subclass `_q` virtual dispatch**: Before adding a scale-factor `_q` override to
a subclass, check whether the parent `_q` uses `this._cdf` and `this._pdf` internally. If
it does, the inherited `_q` already computes the correct subclass quantile via virtual
dispatch — no override is needed. An override that multiplies by a scale factor will
double-apply the transform and produce wrong answers.

## Related Solutions

- `solutions/performance/2026-05-23-1810-super-q-v8-megamorphic-deoptimization.md` —
  V8 megamorphic deoptimization from `super._q()` calls across 6+ subclasses; inline the
  parent formula instead. Complements this solution (scale-factor subclass overrides are
  safe for single subclasses; this solution shows they may also be unnecessary).
- `solutions/correctness/2026-05-23-1930-gamma-subclass-q-inheritance-guard.md` —
  When a subclass `_cdf` differs structurally from the parent's, the inherited `_q` is wrong
  and must be guarded with `this._q = undefined`. This solution is the mirror case: when
  `_cdf` is a scaled call to the parent's `_cdf`, virtual dispatch makes the inherited `_q`
  correct automatically.

## Key Insight

When `erfinv` is used only as a Newton seed, replace it with the A&S §26.2.17 rational
approximation — `erfinv` runs its own internal Newton loop (~9.5µs) and will dominate total
quantile cost, producing worse performance than the Brent fallback the new method was meant
to replace.
