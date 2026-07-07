---
date: 2026-07-07T15:00:00Z
category: "correctness"
problem: "path() restored process state but silently advanced the PRNG, breaking reproducibility"
status: complete
related_issue: "#847"
related_plan: "thoughts/plans/2026-07-07-1430-process-base-class.md"
tags: [process, prng, non-destructive, reproducibility, path, xoshiro]
---

# Solution: path() PRNG save/restore

**Date**: 2026-07-07T15:00:00Z
**Category**: correctness
**Related Issue**: #847

## Problem

`path(n)` is documented as non-destructive — calling it should not change the observable
state of the process. The initial implementation saved and restored only `this.x` (the
process state scalar). This satisfies the visible invariant tested by `p.state()`, but the
PRNG (`this.r`) was still advanced during the loop because each `_next()` call draws random
numbers. After `path()` returned, `this.r` was at a different stream position, causing any
subsequent `next()` or `path()` call to produce a different sequence than it would have
without the intervening `path()` call — a silent, non-reproducible side effect.

## Root Cause

"Non-destructive" for a stateful stochastic process has two independent components: the
mathematical state (`this.x`) and the PRNG stream position (`this.r`). Saving only `this.x`
restores the visible state but leaves the random stream permanently advanced. Because
`this.r`'s position is invisible to callers and does not appear in any assertion on
`p.state()`, a test that only checks `p.state()` after `path()` cannot detect this bug —
the test passes while the contract is still broken.

## Fix

Wrap the `path()` loop with PRNG checkpointing:

```js
const savedRng = this.r.save()
// ... loop ...
this.r.load(savedRng)
```

`Xoshiro128p` already exposes `save()` / `load()` — the fix is two lines. Both the process
state and the random stream are returned exactly to their pre-call positions.

## Prevention Strategy

Any method on a PRNG-bearing object that is documented as non-destructive must checkpoint
and restore the PRNG, not just the domain state. Write a dedicated test that:
1. Calls `path()` on an instance, then calls `next()` twice.
2. On a fresh identical instance, calls `next()` twice without any `path()`.
3. Asserts both sequences are identical.

A `p.state()` assertion alone cannot prove PRNG purity — it only checks the mathematical
state, not the stream position.

## Related Solutions

None — first Process-class solution.

## Key Insight

When a stochastic object promises a non-destructive read, restoring only the mathematical
state (`this.x`) is insufficient — the PRNG position (`this.r`) is an invisible second
piece of state that must also be saved and restored, and the bug is undetectable by any test
that only inspects `state()`.
