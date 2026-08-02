---
date: 2026-08-02T18:30:00Z
category: "tooling"
problem: "scripts/precision-refs-continuous.py's bare (no-args) invocation, documented as 'rewrites the test file', actually runs self_check() and writes nothing"
status: complete
related_issue: "1308"
related_plan: "thoughts/plans/2026-08-02-1520-vonmises-large-kappa-nan.md"
tags: [precision-refs, mpmath, docstring-mismatch, self-check, cost-avoidance, generator-script]
---

# Solution: `precision-refs-continuous.py`'s bare invocation self-checks, it does not emit

**Date**: 2026-08-02
**Category**: tooling
**Related Issue**: #1308

## Problem

Regenerating `test/precision-continuous.js` for three new `VonMises` large-kappa parameter sets, the natural first step was to run `python3 scripts/precision-refs-continuous.py` with no arguments — exactly the invocation the script's own module docstring documents on line 16: `python3 scripts/precision-refs-continuous.py   # rewrites the test file`. It did not rewrite the test file. The run printed progress for essentially every distribution in the suite, took roughly an hour, and left `test/precision-continuous.js` byte-identical to before. `--emit` then had to be run separately — which, with no `/tmp/precision-continuous-cache.json` yet on disk, triggered a second full, uncached `compute_cache()` pass (another ~30-65 minutes, dominated by `DoublyNoncentralBeta`) to actually produce the file. The first hour-long run contributed nothing toward the goal.

## Root Cause

The script's `__main__` dispatch (`scripts/precision-refs-continuous.py:2816-2833`) only routes to `emit()` when the first CLI argument is literally `--emit`, and to a fast cached re-render when it is `--render`. Anything else — including no arguments at all — falls through to `self_check(only)`, a read-only cross-check that re-derives every distribution's `pdf()`/`cdf()` via this script's own mpmath formulas and compares them against the values already frozen in `test/dist-cases-continuous.js`'s `refVals`. `self_check()` and `emit()`/`compute_cache()` are two structurally different code paths — validation vs. generation — that happen to share the same cost profile (iterate over every distribution, hit mpmath for each), so a contributor watching the printed `... VonMises`, `... Normal`, ... progress lines cannot tell "this is regenerating the file" from "this is silently validating and will write nothing" until the run finishes and `git diff` on the target file comes back empty. The docstring's usage line describing the bare invocation is simply wrong for what the bare invocation actually does.

## Fix

No change was made to the script itself in this session (correcting the docstring, or making the bare invocation actually emit, is out of scope for issue #1308's VonMises overflow fix). The workaround was operational: once the bare run's true behavior was recognized, `--emit` was invoked explicitly, which correctly wrote the file (populating `/tmp/precision-continuous-cache.json` in the process, so a subsequent `--emit --only VonMises` re-run — needed after adjusting a tolerance override — reused the cache and completed in seconds rather than repeating the full computation).

## Prevention Strategy

Before running `scripts/precision-refs-continuous.py` with the goal of regenerating `test/precision-continuous.js`, always pass `--emit` explicitly — never rely on the bare/no-args form matching its own docstring. More generally: verify what a long-running generator script actually did (`git diff` on the target file, or `git status`) before trusting that its invocation matched its documented usage — especially for a script this file's own two prior related solutions already establish has confusing cost/mode semantics. A script whose "default" documented invocation is secretly a diagnostic mode, not the primary action, will cost real wall-clock time on every future contributor who trusts the docstring over the dispatch code, until the docstring itself is fixed.

## Related Solutions

- `solutions/tooling/2026-07-26-2200-precision-refs-only-flag-cache-scope-not-compute-scope.md` — a different trap in the same script, one level downstream of this one: assuming the reader already knows to pass `--emit`, it documents that `--only <name>` scopes cache *reuse*, not computation, so an uncached `--emit --only <name>` still recomputes everything. This solution's insight is the prerequisite step: the bare invocation (no `--emit` at all) doesn't attempt emission in the first place — it silently dispatches to `self_check()` instead, contradicting the script's own documented usage line.
- `solutions/testing/2026-07-24-1141-precision-refs-self-check-never-ran.md` — documents `self_check()` itself being broken/dormant (it opened a nonexistent file) for a long time before being fixed. That solution is about `self_check` not working at all when invoked; this one is about `self_check` running successfully but being invoked *by accident* in place of `emit`, because the bare-invocation dispatch doesn't match the docstring's claim.

## Key Insight

`scripts/precision-refs-continuous.py`'s bare/no-args invocation dispatches to `self_check()` (a read-only, whole-suite mpmath cross-check against `dist-cases-continuous.js`), not `emit()`, despite the script's own docstring line 16 claiming it "rewrites the test file" — `--emit` must always be passed explicitly to regenerate `test/precision-continuous.js`, and the docstring line itself should eventually be corrected to stop asserting otherwise.
