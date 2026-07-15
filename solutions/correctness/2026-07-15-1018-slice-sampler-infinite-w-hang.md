---
date: 2026-07-15T10:18:04Z
category: "correctness"
problem: "SliceSampler's w validator accepted Infinity, which turns _shrink's unbounded loop into an infinite hang"
status: complete
related_issue: "#822"
related_plan: "thoughts/plans/2026-07-15-0730-slice-sampler.md"
tags: [mcmc, slice-sampler, validation, infinite-loop, finiteness, boundary-testing, review]
---

# Solution: SliceSampler's `w` validator accepted `Infinity`, turning an unbounded loop into an infinite hang

**Date**: 2026-07-15T10:18:04Z
**Category**: correctness
**Related Issue**: #822

## Problem

`SliceSampler`'s constructor validates its one tunable parameter, `w` (interval width), with a
predicate that reduces to `typeof w === 'number' && w > 0`. This accepts `w: Infinity`. With
`w = Infinity`, `_stepOut` (`src/mc/slice.js`) computes `l = x0 - Infinity * U = -Infinity` and
`r = l + Infinity = NaN`. `_shrink`'s shrinkage loop (`for (;;) { ... }`, unbounded by design —
Neal (2003)'s correctness proof relies on it always terminating in finitely many steps) then
repeatedly draws `NaN` candidates and checks `NaN > logY`, which is always `false`. The loop
never returns: a single constructor argument silently produces an infinite hang, not a rejected
input.

This survived both the initial TDD implementation (commit `be68fc8`) and a first bug-triage pass
(commit `79b5bdb`, which added validation but only for `w <= 0`) undetected, because nothing in
the constructor path exercises the downstream interval arithmetic — the failure surfaces two
function calls later, inside an unbounded loop, only when the numeric tunable actually feeds
`x0 - w*U` / `l + w`.

## Root Cause

`typeof x === 'number' && x > 0` is not the same predicate as "finite positive number" —
`Infinity` satisfies the former while failing the latter. Boundary testing conventionally probes
the sign boundary (`0`, negative values) but not the finiteness boundary (`Infinity`, `-Infinity`,
`NaN`), so a validator built around "reject non-positive" naturally covers the sign case and
naturally misses the finiteness case unless it is deliberately included.

This is the third instance in the `ran.mc` module of a numeric config/tunable field passing a
naive validity check while remaining arithmetically unsafe downstream, but it is a distinct
sub-pattern from the other two:
- `solutions/correctness/2026-07-13-1624-mcmc-arwindow-sibling-bound-gap.md` — `arWindow` had
  **no upper bound at all** (missing check entirely).
- `solutions/correctness/2026-07-11-1230-mcmc-state-key-mismatch-silent-sigma-loss.md` — a
  **different flavor**: a serialization key mismatch, not a validation gap.
- This case — the bound **exists** (rejects `<= 0`) but is **incomplete**, because finiteness was
  never required alongside positivity, so `Infinity` slips through a check that looks complete at
  a glance.

## Fix

Changed `SliceSampler._isPositiveNumber` from `typeof w === 'number' && w > 0` to
`Number.isFinite(w) && w > 0` (`src/mc/slice.js`) — `Number.isFinite` alone already excludes
non-numbers, `NaN`, and both infinities, so combined with `w > 0` it is a complete, single-line
finite-positive-number check. Added a regression test (`test/mc.js`) asserting
`new SliceSampler(..., { internal: { w: Infinity } })` throws, with an inline comment naming the
exact `NaN`-bracket mechanism it prevents.

Found during the mandatory `/review` pass (not the earlier bug-triage pass) by two independent
reviewer agents converging from different angles on the same line: the tests reviewer noticed an
existing test titled "should throw for a non-finite w" only exercised `NaN`, not `Infinity`,
despite the title's broader claim; the correctness reviewer independently traced the exact
`-Infinity`/`NaN` bracket-collapse mechanism through `_stepOut` and `_shrink`. Two reviewers
reaching the same fix from different reasoning paths is a strong signal the finding was real, not
a false positive — this is the same convergence pattern the `/review` skill's tier system is
designed to surface (correctness and tests independently corroborating one another).

## Prevention Strategy

Whenever a validator's job is "must be safe to use in unbounded/looping numeric arithmetic
downstream" (interval bracketing, shrinkage loops, step sizes, adaptation rates, any accumulator
feeding a `for (;;)` or otherwise-open-ended loop), require `Number.isFinite(x)` in addition to
any sign/range check — never rely on `typeof x === 'number' && x > <bound>` alone, since that
predicate silently admits `Infinity`.

When writing or reviewing boundary tests for any numeric tunable, explicitly include
`Infinity`/`-Infinity`/`NaN` cases alongside the conventional `0` and negative-value cases — a
test suite that only checks the sign boundary can pass in full while the finiteness boundary
remains completely uncovered, exactly as happened here across two rounds of testing before
`/review` caught it.

## Related Solutions

- [`solutions/correctness/2026-07-13-1624-mcmc-arwindow-sibling-bound-gap.md`](2026-07-13-1624-mcmc-arwindow-sibling-bound-gap.md) — the sibling-field-audit discipline this extends: a bound that exists for one field (or one *aspect* of a field, as here) doesn't automatically cover a structurally adjacent gap (another field, or another dimension of the same field's validity) unless explicitly audited.
- [`solutions/correctness/2026-07-11-1230-mcmc-state-key-mismatch-silent-sigma-loss.md`](2026-07-11-1230-mcmc-state-key-mismatch-silent-sigma-loss.md) — a different flavor of the same underlying lesson: an MCMC subclass's config/state surface silently disagreeing with what the code actually needs, invisible until specifically tested for.

## Key Insight

A "positive number" validator that omits `Number.isFinite` is not actually a complete range
check — `Infinity` passes it, and in any code path that does interval arithmetic
(`x0 - w*U`, `l + w`) inside an unbounded loop, that silently degrades to `NaN` comparisons that
never terminate, so every numeric-tunable validator feeding a stepping-out/shrinkage-style loop
must pair its sign/range check with an explicit finiteness check.
