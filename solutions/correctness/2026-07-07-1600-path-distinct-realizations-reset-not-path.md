---
date: 2026-07-07T16:00:00Z
category: "correctness"
problem: "Calling proc.path() K times yields K identical paths, not K distinct realizations"
status: complete
related_issue: "#862"
related_plan: "thoughts/plans/2026-07-07-1540-process-demo-section.md"
tags: [process, path, prng, stochastic, demo, non-destructive, seed, reset]
---

# Solution: K Distinct Paths via reset() + next(), Not path() × K

**Date**: 2026-07-07T16:00:00Z
**Category**: correctness
**Related Issue**: #862

## Problem

When the demo page needed to render 7 distinct sample paths for a stochastic process,
calling `proc.path(steps)` in a loop K times produced K **identical** overlapping lines
rather than K genuinely independent realizations. The chart looked like a single path,
defeating the visual purpose of the demo entirely.

## Root Cause

`path()` is non-destructive: it snapshots both the process state (`this.x`) and the
PRNG stream position (`this.r.save()`) before generating, then restores both after.
This design was deliberately introduced in the fix for issue #847 (see
`solutions/correctness/2026-07-07-1500-path-prng-save-restore.md`) to prevent the
PRNG from being silently advanced after each `path()` call.

The consequence is that `path()` is fully idempotent: every call from the same object
state produces the exact same sequence. Calling it K times from the same state gives K
copies of path #1, not K independent paths.

## Fix

Seed once, then in each loop iteration call `proc.reset()` (resets `this.x` to `x0`
only — intentionally does **not** touch the PRNG) and manually advance with
`proc.next()`. The PRNG stream advances naturally between paths, producing genuinely
distinct realizations:

```js
proc.seed(42)
const paths = Array.from({length: PATH_COUNT}, () => {
  proc.reset()
  const pts = [proc.x0]
  for (let i = 0; i < steps; i++) pts.push(proc.next())
  return pts
})
```

## Prevention Strategy

- Use `path(n)` when you need a **single** reproducible path without altering subsequent
  draws (e.g. unit tests that call `path()` multiple times and assert the same result).
- Use seed-once + `reset()` + `next()` loop when you need **K distinct** independent
  realizations from the same process instance.
- Add a comment citing this solution file at any site that generates multiple paths to
  make the pattern explicit for future readers.

## Related Solutions

- `solutions/correctness/2026-07-07-1500-path-prng-save-restore.md` — root cause of
  why `path()` is non-destructive in the first place (save/restore PRNG fix for #847)

## Key Insight

`path()` is non-destructive (saves and restores both `this.x` and the PRNG stream), so
calling it K times always returns K identical paths — to get K distinct paths, call
`proc.seed(42)` once, then loop over `proc.reset()` + `proc.next()` so the PRNG
advances freely between iterations.
